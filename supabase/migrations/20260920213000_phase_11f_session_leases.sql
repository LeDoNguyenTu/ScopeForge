-- Phase 11F opaque credential/session lease authority.
-- Forward-only. Source merge does not enable hosted browser execution.

create table private.pentest_session_leases (
  id uuid primary key,
  workspace_id uuid not null,
  run_id uuid not null,
  authorization_snapshot_ref text not null,
  target_node_id text not null,
  identity_id text not null,
  credential_class text not null,
  session_class text not null,
  credential_ref_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint pentest_session_leases_run_fkey
    foreign key (run_id, workspace_id)
    references private.pentest_runs(id, workspace_id)
    on delete cascade,
  check (char_length(authorization_snapshot_ref) between 1 and 512),
  check (char_length(target_node_id) between 1 and 512),
  check (char_length(identity_id) between 1 and 256),
  check (char_length(credential_class) between 1 and 128),
  check (char_length(session_class) between 1 and 128),
  check (credential_ref_hash ~ '^[0-9a-f]{64}$'),
  check (expires_at > created_at),
  check (revoked_at is null or revoked_at >= created_at)
);

create index pentest_session_leases_scope_idx
  on private.pentest_session_leases(workspace_id, run_id, target_node_id, expires_at desc);

alter table private.pentest_session_leases enable row level security;
revoke all on table private.pentest_session_leases from public, anon, authenticated, service_role;

create or replace function public.create_phase11_session_lease(
  target_lease_id uuid,
  target_workspace_id uuid,
  target_run_id uuid,
  target_authorization_snapshot_ref text,
  target_target_node_id text,
  target_identity_id text,
  target_credential_class text,
  target_session_class text,
  target_credential_ref_hash text,
  target_expires_at timestamptz,
  target_created_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot private.pentest_run_authorization_snapshots%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'PHASE11_SESSION_LEASE_FORBIDDEN';
  end if;
  if target_lease_id is null
    or target_workspace_id is null
    or target_run_id is null
    or target_created_by is null
    or target_authorization_snapshot_ref is null
    or target_target_node_id is null
    or target_identity_id is null
    or target_credential_class is null
    or target_session_class is null
    or target_credential_ref_hash !~ '^[0-9a-f]{64}$'
    or target_expires_at is null
    or target_expires_at <= now()
  then
    raise exception 'PHASE11_SESSION_LEASE_INPUT_INVALID';
  end if;

  select *
  into snapshot
  from private.pentest_run_authorization_snapshots
  where workspace_id = target_workspace_id
    and run_id = target_run_id
    and snapshot_ref = target_authorization_snapshot_ref;

  if not found or snapshot.expires_at <= now() then
    raise exception 'PHASE11_SESSION_LEASE_AUTHORIZATION_INVALID';
  end if;
  if not (target_target_node_id = any(snapshot.authorized_node_ids)) then
    raise exception 'PHASE11_SESSION_LEASE_TARGET_OUTSIDE_AUTHORIZATION';
  end if;
  if target_expires_at > snapshot.expires_at then
    raise exception 'PHASE11_SESSION_LEASE_EXPIRY_EXCEEDS_AUTHORIZATION';
  end if;
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = target_created_by
      and role in ('owner','admin')
  ) then
    raise exception 'PHASE11_SESSION_LEASE_CREATOR_FORBIDDEN';
  end if;

  insert into private.pentest_session_leases (
    id, workspace_id, run_id, authorization_snapshot_ref, target_node_id,
    identity_id, credential_class, session_class, credential_ref_hash,
    expires_at, created_by
  ) values (
    target_lease_id, target_workspace_id, target_run_id, target_authorization_snapshot_ref, target_target_node_id,
    target_identity_id, target_credential_class, target_session_class, target_credential_ref_hash,
    target_expires_at, target_created_by
  );

  return jsonb_build_object('leaseId', target_lease_id, 'expiresAt', target_expires_at);
end;
$$;

revoke all on function public.create_phase11_session_lease(uuid,uuid,uuid,text,text,text,text,text,text,timestamptz,uuid)
  from public, anon, authenticated;
grant execute on function public.create_phase11_session_lease(uuid,uuid,uuid,text,text,text,text,text,text,timestamptz,uuid)
  to service_role;

create or replace function public.revoke_phase11_session_lease(
  target_lease_id uuid,
  target_workspace_id uuid,
  target_run_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'PHASE11_SESSION_LEASE_FORBIDDEN';
  end if;
  update private.pentest_session_leases
  set revoked_at = coalesce(revoked_at, now())
  where id = target_lease_id
    and workspace_id = target_workspace_id
    and run_id = target_run_id;
  return found;
end;
$$;

revoke all on function public.revoke_phase11_session_lease(uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.revoke_phase11_session_lease(uuid,uuid,uuid)
  to service_role;
