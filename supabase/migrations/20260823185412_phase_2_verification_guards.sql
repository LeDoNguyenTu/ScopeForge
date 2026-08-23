create or replace function private.guard_asset_verification_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.workspace_id is distinct from old.workspace_id or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'Immutable asset fields cannot be changed';
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

create trigger assets_guard_verification_fields
before update on public.assets
for each row execute function private.guard_asset_verification_fields();

create or replace function private.guard_verification_challenge_update()
returns trigger language plpgsql set search_path = '' as $$
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
  if new.last_attempt_at is distinct from old.last_attempt_at and new.attempt_count <= old.attempt_count then
    raise exception 'Verification attempt timestamp requires an incremented attempt count';
  end if;
  return new;
end;
$$;

create trigger verification_guard_update
before update on public.asset_verification_challenges
for each row execute function private.guard_verification_challenge_update();

create or replace function private.sync_verification_usage()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  delta integer;
begin
  delta := new.attempt_count - old.attempt_count;
  if delta <= 0 then return new; end if;

  insert into public.workspace_usage (workspace_id, verification_attempts_today, verification_attempt_date)
  values (new.workspace_id, delta, current_date)
  on conflict (workspace_id) do update set
    verification_attempts_today = case
      when public.workspace_usage.verification_attempt_date = current_date
        then public.workspace_usage.verification_attempts_today + delta
      else delta
    end,
    verification_attempt_date = current_date,
    updated_at = now();
  return new;
end;
$$;

create trigger verification_sync_usage_after_update
after update of attempt_count on public.asset_verification_challenges
for each row execute function private.sync_verification_usage();
