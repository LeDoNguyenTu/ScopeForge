create or replace function public.commit_runtime_worker_preparation(
  target_worker_id uuid,
  target_task_id uuid,
  target_attempt_id uuid,
  target_lease_token text,
  target_expected_asset_canonical_target text,
  target_expected_asset_kind text,
  target_expected_asset_hostname text,
  target_expected_asset_verified_at timestamptz,
  target_expected_job_authorization_canonical_target text,
  target_expected_job_authorization_asset_kind text,
  target_expected_job_authorization_verified_at timestamptz,
  target_expected_job_validation_profile_id text,
  target_expected_job_validation_profile_version integer,
  target_expected_job_authorization_granted_at timestamptz,
  target_expected_job_budget jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_record private.worker_nodes%rowtype;
  task_record private.worker_tasks%rowtype;
  runtime_task private.runtime_worker_tasks%rowtype;
  attempt_record private.worker_attempts%rowtype;
  job_record public.scan_jobs%rowtype;
  asset_record public.assets%rowtype;
  calculated_hash text;
  commit_now timestamptz := now();
begin
  if target_lease_token is null or target_lease_token !~ '^[a-f0-9]{64}$' then
    raise exception 'WORKER_LEASE_INVALID';
  end if;
  if target_expected_asset_canonical_target is null
     or target_expected_asset_kind not in ('web_application', 'api')
     or target_expected_asset_hostname is null
     or target_expected_asset_verified_at is null
     or target_expected_job_authorization_canonical_target is null
     or target_expected_job_authorization_asset_kind not in ('web_application', 'api')
     or target_expected_job_authorization_verified_at is null
     or target_expected_job_budget is null then
    raise exception 'RUNTIME_WORKER_TASK_INVALID';
  end if;

  calculated_hash := encode(
    extensions.digest(decode(target_lease_token, 'hex'), 'sha256'),
    'hex'
  );

  select * into attempt_record
    from private.worker_attempts
   where id = target_attempt_id
     and task_id = target_task_id
   for update;

  if attempt_record.id is null
     or attempt_record.worker_id <> target_worker_id
     or attempt_record.lease_token_hash <> calculated_hash
     or attempt_record.finished_at is not null
     or attempt_record.lease_expires_at <= commit_now then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  select * into worker_record
    from private.worker_nodes
   where id = target_worker_id
   for update;

  if worker_record.id is null
     or worker_record.disabled_at is not null
     or worker_record.execution_class not in (
       'passive_runtime_observation_v1',
       'active_cors_validation_v1'
     ) then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  select * into task_record
    from private.worker_tasks
   where id = target_task_id
   for update;

  if task_record.id is null
     or task_record.execution_class <> worker_record.execution_class
     or task_record.state <> 'leased'
     or task_record.attempt_count <> 1
     or task_record.max_attempts <> 1
     or task_record.absolute_deadline_at <= commit_now then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  select * into runtime_task
    from private.runtime_worker_tasks
   where task_id = task_record.id
     and scan_job_id = task_record.scan_job_id
     and workspace_id = task_record.workspace_id
     and asset_id = task_record.asset_id;

  if runtime_task.task_id is null then
    raise exception 'RUNTIME_WORKER_TASK_INVALID';
  end if;

  select * into job_record
    from public.scan_jobs
   where id = runtime_task.scan_job_id
     and workspace_id = runtime_task.workspace_id
     and asset_id = runtime_task.asset_id
   for update;

  select * into asset_record
    from public.assets
   where id = runtime_task.asset_id
     and workspace_id = runtime_task.workspace_id
   for update;

  if job_record.id is null
     or asset_record.id is null
     or job_record.status <> 'queued'::public.scan_job_status
     or job_record.cancel_requested_at is not null
     or job_record.requested_by <> runtime_task.requested_by
     or job_record.job_kind <> runtime_task.domain_job_kind
     or asset_record.verification_status::text <> 'verified'
     or asset_record.verified_at is null
     or asset_record.hostname is null then
    raise exception 'RUNTIME_WORKER_TASK_INVALID';
  end if;

  if asset_record.canonical_target is distinct from target_expected_asset_canonical_target
     or asset_record.kind::text is distinct from target_expected_asset_kind
     or asset_record.hostname is distinct from target_expected_asset_hostname
     or asset_record.verified_at is distinct from target_expected_asset_verified_at
     or job_record.authorization_canonical_target is distinct from target_expected_job_authorization_canonical_target
     or job_record.authorization_asset_kind::text is distinct from target_expected_job_authorization_asset_kind
     or job_record.authorization_verified_at is distinct from target_expected_job_authorization_verified_at
     or job_record.validation_profile_id is distinct from target_expected_job_validation_profile_id
     or job_record.validation_profile_version is distinct from target_expected_job_validation_profile_version
     or job_record.authorization_granted_at is distinct from target_expected_job_authorization_granted_at
     or job_record.budget is distinct from target_expected_job_budget then
    raise exception 'RUNTIME_WORKER_TASK_INVALID';
  end if;

  if job_record.authorization_canonical_target is distinct from asset_record.canonical_target
     or job_record.authorization_asset_kind::text is distinct from asset_record.kind::text
     or job_record.authorization_verified_at is distinct from asset_record.verified_at then
    raise exception 'RUNTIME_WORKER_TASK_INVALID';
  end if;

  if task_record.execution_class = 'passive_runtime_observation_v1' then
    if runtime_task.domain_job_kind <> 'passive_runtime'::public.scan_job_kind
       or job_record.job_kind <> 'passive_runtime'::public.scan_job_kind then
      raise exception 'RUNTIME_WORKER_CLASS_MISMATCH';
    end if;
  elsif task_record.execution_class = 'active_cors_validation_v1' then
    if runtime_task.domain_job_kind <> 'active_validation'::public.scan_job_kind
       or job_record.job_kind <> 'active_validation'::public.scan_job_kind
       or job_record.validation_profile_id <> 'cors-origin-policy'
       or job_record.validation_profile_version <> 1
       or job_record.authorization_granted_at is null then
      raise exception 'RUNTIME_WORKER_CLASS_MISMATCH';
    end if;
  else
    raise exception 'RUNTIME_WORKER_CLASS_MISMATCH';
  end if;

  update public.scan_jobs
     set status = 'running'::public.scan_job_status,
         started_at = commit_now
   where id = job_record.id
     and workspace_id = job_record.workspace_id
     and asset_id = job_record.asset_id
     and status = 'queued'::public.scan_job_status
     and cancel_requested_at is null
  returning * into job_record;

  if job_record.id is null then
    raise exception 'RUNTIME_WORKER_TASK_INVALID';
  end if;

  update private.worker_nodes
     set last_seen_at = greatest(coalesce(last_seen_at, commit_now), commit_now)
   where id = worker_record.id;

  perform private.record_worker_event(
    'worker.runtime_prepared',
    task_record.workspace_id,
    worker_record.id,
    task_record.id,
    jsonb_build_object(
      'attemptId', attempt_record.id,
      'executionClass', task_record.execution_class
    )
  );

  return jsonb_build_object(
    'jobId', job_record.id,
    'status', 'running',
    'startedAt', job_record.started_at
  );
end;
$$;

revoke all on function public.commit_runtime_worker_preparation(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  timestamptz,
  text,
  integer,
  timestamptz,
  jsonb
) from public, anon, authenticated, service_role;

grant execute on function public.commit_runtime_worker_preparation(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  timestamptz,
  text,
  integer,
  timestamptz,
  jsonb
) to service_role;
