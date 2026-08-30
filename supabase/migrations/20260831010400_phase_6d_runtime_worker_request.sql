create or replace function public.request_passive_runtime_worker_job(
  target_workspace_id uuid,
  target_asset_id uuid,
  target_actor_id uuid,
  target_canonical_target text,
  target_asset_kind public.asset_kind,
  target_verified_at timestamptz,
  target_budget jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record public.scan_jobs%rowtype;
  worker_result jsonb;
begin
  if target_workspace_id is null
     or target_asset_id is null
     or target_actor_id is null
     or target_canonical_target is null
     or char_length(target_canonical_target) not between 1 and 2048
     or target_asset_kind not in ('web_application'::public.asset_kind, 'api'::public.asset_kind)
     or target_verified_at is null
     or jsonb_typeof(target_budget) is distinct from 'object'
     or pg_column_size(target_budget) > 2048 then
    raise exception 'RUNTIME_WORKER_TASK_INVALID';
  end if;

  insert into public.scan_jobs (
    workspace_id,
    asset_id,
    job_kind,
    status,
    requested_by,
    blocked_reason,
    authorization_canonical_target,
    authorization_asset_kind,
    authorization_verified_at,
    validation_profile_id,
    validation_profile_version,
    authorization_granted_at,
    budget
  ) values (
    target_workspace_id,
    target_asset_id,
    'passive_runtime'::public.scan_job_kind,
    'queued'::public.scan_job_status,
    target_actor_id,
    null,
    target_canonical_target,
    target_asset_kind,
    target_verified_at,
    null,
    null,
    null,
    target_budget
  )
  returning * into job_record;

  worker_result := public.enqueue_passive_runtime_worker_task(
    target_workspace_id,
    job_record.id,
    target_actor_id
  );

  return worker_result;
end;
$$;

create or replace function public.request_active_cors_worker_job(
  target_workspace_id uuid,
  target_asset_id uuid,
  target_actor_id uuid,
  target_canonical_target text,
  target_asset_kind public.asset_kind,
  target_verified_at timestamptz,
  target_profile_id text,
  target_profile_version integer,
  target_authorization_granted_at timestamptz,
  target_budget jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record public.scan_jobs%rowtype;
  worker_result jsonb;
begin
  if target_workspace_id is null
     or target_asset_id is null
     or target_actor_id is null
     or target_canonical_target is null
     or char_length(target_canonical_target) not between 1 and 2048
     or target_asset_kind not in ('web_application'::public.asset_kind, 'api'::public.asset_kind)
     or target_verified_at is null
     or target_profile_id is distinct from 'cors-origin-policy'
     or target_profile_version is distinct from 1
     or target_authorization_granted_at is null
     or jsonb_typeof(target_budget) is distinct from 'object'
     or target_budget is distinct from '{"maxRequests":1,"maxRedirects":0,"perRequestTimeoutMs":5000,"totalTimeoutMs":10000,"maxObservationBytes":32768}'::jsonb then
    raise exception 'RUNTIME_WORKER_TASK_INVALID';
  end if;

  insert into public.scan_jobs (
    workspace_id,
    asset_id,
    job_kind,
    status,
    requested_by,
    blocked_reason,
    authorization_canonical_target,
    authorization_asset_kind,
    authorization_verified_at,
    validation_profile_id,
    validation_profile_version,
    authorization_granted_at,
    budget
  ) values (
    target_workspace_id,
    target_asset_id,
    'active_validation'::public.scan_job_kind,
    'queued'::public.scan_job_status,
    target_actor_id,
    null,
    target_canonical_target,
    target_asset_kind,
    target_verified_at,
    target_profile_id,
    target_profile_version,
    target_authorization_granted_at,
    target_budget
  )
  returning * into job_record;

  worker_result := public.enqueue_active_cors_worker_task(
    target_workspace_id,
    job_record.id,
    target_actor_id
  );

  return worker_result;
end;
$$;

revoke all on function public.request_passive_runtime_worker_job(
  uuid, uuid, uuid, text, public.asset_kind, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.request_passive_runtime_worker_job(
  uuid, uuid, uuid, text, public.asset_kind, timestamptz, jsonb
) to service_role;

revoke all on function public.request_active_cors_worker_job(
  uuid, uuid, uuid, text, public.asset_kind, timestamptz, text, integer, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.request_active_cors_worker_job(
  uuid, uuid, uuid, text, public.asset_kind, timestamptz, text, integer, timestamptz, jsonb
) to service_role;
