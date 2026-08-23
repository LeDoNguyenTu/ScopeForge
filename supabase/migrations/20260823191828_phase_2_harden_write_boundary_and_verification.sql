alter table public.asset_verification_challenges
  add column revoked_at timestamptz;

alter table public.assets
  add constraint assets_id_workspace_key unique (id, workspace_id);

alter table public.asset_verification_challenges
  drop constraint asset_verification_challenges_asset_id_fkey,
  add constraint asset_verification_challenges_asset_workspace_fkey
    foreign key (asset_id, workspace_id)
    references public.assets(id, workspace_id)
    on delete cascade;

alter table public.scan_jobs
  drop constraint scan_jobs_asset_id_fkey,
  add constraint scan_jobs_asset_workspace_fkey
    foreign key (asset_id, workspace_id)
    references public.assets(id, workspace_id)
    on delete cascade;

create unique index asset_verification_one_active_per_asset_idx
  on public.asset_verification_challenges(asset_id)
  where revoked_at is null;

drop policy if exists assets_insert_contributor on public.assets;
drop policy if exists assets_update_contributor on public.assets;
drop policy if exists assets_delete_contributor on public.assets;
drop policy if exists verification_insert_contributor on public.asset_verification_challenges;
drop policy if exists verification_update_contributor on public.asset_verification_challenges;
drop policy if exists verification_delete_contributor on public.asset_verification_challenges;
drop policy if exists audit_events_insert_actor_bound on public.audit_events;

revoke all on table public.assets from anon, authenticated;
revoke all on table public.asset_verification_challenges from anon, authenticated;
revoke all on table public.scan_jobs from anon, authenticated;
revoke all on table public.audit_events from anon, authenticated;
revoke all on table public.workspace_usage from anon, authenticated;

grant select on table public.assets to authenticated;
grant select on table public.asset_verification_challenges to authenticated;
grant select on table public.scan_jobs to authenticated;
grant select on table public.audit_events to authenticated;
grant select on table public.workspace_usage to authenticated;

create or replace function private.guard_asset_verification_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
     or new.kind is distinct from old.kind
     or new.canonical_target is distinct from old.canonical_target
     or new.hostname is distinct from old.hostname
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Immutable asset identity fields cannot be changed';
  end if;

  if (
    new.verification_status is distinct from old.verification_status
    or new.verified_at is distinct from old.verified_at
    or new.verified_by is distinct from old.verified_by
  ) and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Verification state can only be changed by the trusted verification service';
  end if;

  return new;
end;
$$;

create or replace function private.guard_verification_challenge_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
     or new.asset_id is distinct from old.asset_id
     or new.method is distinct from old.method
     or new.token_hash is distinct from old.token_hash
     or new.expires_at is distinct from old.expires_at
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Verification challenge identity fields are immutable';
  end if;

  if new.attempt_count < old.attempt_count then
    raise exception 'Verification attempt count cannot decrease';
  end if;

  if new.last_attempt_at is distinct from old.last_attempt_at
     and new.attempt_count <= old.attempt_count then
    raise exception 'Verification attempt timestamp requires an incremented attempt count';
  end if;

  if new.revoked_at is distinct from old.revoked_at
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Verification challenge revocation requires the trusted verification service';
  end if;

  return new;
end;
$$;

create or replace function private.enforce_trial_asset_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.workspace_id::text, 0));

  select count(*)::integer
    into current_count
    from public.assets
    where workspace_id = new.workspace_id;

  if current_count >= 10 then
    raise exception using
      errcode = 'P0001',
      message = 'ASSET_LIMIT_REACHED';
  end if;

  return new;
end;
$$;

create trigger assets_enforce_trial_limit
before insert on public.assets
for each row execute function private.enforce_trial_asset_limit();
