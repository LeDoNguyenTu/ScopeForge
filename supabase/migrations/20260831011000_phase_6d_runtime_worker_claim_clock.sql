create or replace function public.claim_runtime_worker_task(
  target_worker_id uuid
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
  selection_now timestamptz;
  claim_now timestamptz;
  lease_token bytea;
  lease_token_text text;
  lease_expiry timestamptz;
  execution_budget jsonb;
  input_kind text;
begin
  if target_worker_id is null then
    raise exception 'WORKER_NOT_AVAILABLE';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('scopeforge-runtime-worker-claim-v1', 0));

  select * into worker_record
    from private.worker_nodes
   where id = target_worker_id
   for update;

  selection_now := clock_timestamp();

  if worker_record.id is null or worker_record.disabled_at is not null then
    raise exception 'WORKER_DISABLED';
  end if;
  if worker_record.execution_class not in (
    'passive_runtime_observation_v1',
    'active_cors_validation_v1'
  ) then
    raise exception 'WORKER_CLASS_UNAVAILABLE';
  end if;

  if (
    select count(*)
      from private.worker_tasks
     where state = 'leased'
  ) >= 4 then
    return null;
  end if;

  if worker_record.execution_class = 'passive_runtime_observation_v1'
     and (
       select count(*)
         from private.worker_tasks
        where execution_class = 'passive_runtime_observation_v1'
          and state = 'leased'
     ) >= 2 then
    return null;
  end if;

  if worker_record.execution_class = 'active_cors_validation_v1'
     and (
       select count(*)
         from private.worker_tasks
        where execution_class = 'active_cors_validation_v1'
          and state = 'leased'
     ) >= 1 then
    return null;
  end if;

  select t.* into task_record
    from private.worker_tasks t
    join private.runtime_worker_tasks rwt
      on rwt.task_id = t.id
     and rwt.scan_job_id = t.scan_job_id
     and rwt.workspace_id = t.workspace_id
     and rwt.asset_id = t.asset_id
    join public.scan_jobs j
      on j.id = t.scan_job_id
     and j.workspace_id = t.workspace_id
     and j.asset_id = t.asset_id
   where t.execution_class = worker_record.execution_class
     and t.execution_class in (
       'passive_runtime_observation_v1',
       'active_cors_validation_v1'
     )
     and t.state = 'queued'
     and t.attempt_count < t.max_attempts
     and t.available_at <= selection_now
     and t.absolute_deadline_at > selection_now
     and j.status = 'queued'::public.scan_job_status
     and j.cancel_requested_at is null
     and (
       (t.execution_class = 'passive_runtime_observation_v1'
         and rwt.domain_job_kind = 'passive_runtime'::public.scan_job_kind
         and j.job_kind = 'passive_runtime'::public.scan_job_kind)
       or
       (t.execution_class = 'active_cors_validation_v1'
         and rwt.domain_job_kind = 'active_validation'::public.scan_job_kind
         and j.job_kind = 'active_validation'::public.scan_job_kind)
     )
     and not exists (
       select 1
         from private.worker_tasks active_task
        where active_task.workspace_id = t.workspace_id
          and active_task.execution_class in (
            'passive_runtime_observation_v1',
            'active_cors_validation_v1'
          )
          and active_task.state = 'leased'
     )
   order by t.priority desc, t.available_at asc, t.created_at asc, t.id asc
   for update of t skip locked
   limit 1;

  if task_record.id is null then
    return null;
  end if;

  select * into runtime_task
    from private.runtime_worker_tasks
   where task_id = task_record.id
     and scan_job_id = task_record.scan_job_id
     and workspace_id = task_record.workspace_id
     and asset_id = task_record.asset_id;

  select * into job_record
    from public.scan_jobs
   where id = task_record.scan_job_id
     and workspace_id = task_record.workspace_id
     and asset_id = task_record.asset_id
   for update;

  claim_now := clock_timestamp();

  if runtime_task.task_id is null
     or job_record.id is null
     or job_record.status <> 'queued'::public.scan_job_status
     or job_record.cancel_requested_at is not null
     or job_record.requested_by <> runtime_task.requested_by then
    raise exception 'WORKER_JOB_STATE_CONFLICT';
  end if;

  if task_record.absolute_deadline_at <= claim_now then
    return null;
  end if;

  if not (
    (task_record.execution_class = 'passive_runtime_observation_v1'
      and runtime_task.domain_job_kind = 'passive_runtime'::public.scan_job_kind
      and job_record.job_kind = 'passive_runtime'::public.scan_job_kind)
    or
    (task_record.execution_class = 'active_cors_validation_v1'
      and runtime_task.domain_job_kind = 'active_validation'::public.scan_job_kind
      and job_record.job_kind = 'active_validation'::public.scan_job_kind)
  ) then
    raise exception 'RUNTIME_WORKER_CLASS_MISMATCH';
  end if;

  lease_token := extensions.gen_random_bytes(32);
  lease_token_text := encode(lease_token, 'hex');
  lease_expiry := task_record.absolute_deadline_at;

  update private.worker_tasks
     set state = 'leased',
         attempt_count = task_record.attempt_count + 1,
         updated_at = claim_now
   where id = task_record.id
     and state = 'queued'
     and attempt_count = 0
     and max_attempts = 1
     and absolute_deadline_at > claim_now
  returning * into task_record;

  if task_record.id is null then
    return null;
  end if;

  insert into private.worker_attempts (
    task_id,
    attempt_number,
    worker_id,
    lease_token_hash,
    leased_at,
    lease_expires_at,
    last_heartbeat_at
  ) values (
    task_record.id,
    task_record.attempt_count,
    worker_record.id,
    encode(extensions.digest(lease_token, 'sha256'), 'hex'),
    claim_now,
    lease_expiry,
    claim_now
  )
  returning * into attempt_record;

  if task_record.execution_class = 'passive_runtime_observation_v1' then
    execution_budget := '{"maxWallTimeMs":30000,"maxCpuTimeMs":15000,"maxMemoryBytes":268435456,"maxProcesses":1,"maxInputFiles":0,"maxInputBytes":65536,"maxScratchBytes":16777216,"maxOutputBytes":131072}'::jsonb;
    input_kind := 'passive_runtime_observation';
  else
    execution_budget := '{"maxWallTimeMs":20000,"maxCpuTimeMs":10000,"maxMemoryBytes":268435456,"maxProcesses":1,"maxInputFiles":0,"maxInputBytes":32768,"maxScratchBytes":8388608,"maxOutputBytes":65536}'::jsonb;
    input_kind := 'active_cors_validation';
  end if;

  update private.worker_nodes
     set last_seen_at = claim_now
   where id = worker_record.id;

  perform private.record_worker_event(
    'worker.task_claimed',
    task_record.workspace_id,
    worker_record.id,
    task_record.id,
    jsonb_build_object(
      'attemptId', attempt_record.id,
      'attemptNumber', attempt_record.attempt_number,
      'leaseExpiresAt', attempt_record.lease_expires_at,
      'executionClass', task_record.execution_class
    )
  );

  return jsonb_build_object(
    'taskId', task_record.id,
    'attemptId', attempt_record.id,
    'executionClass', task_record.execution_class,
    'leaseToken', lease_token_text,
    'leaseExpiresAt', attempt_record.lease_expires_at,
    'absoluteDeadlineAt', task_record.absolute_deadline_at,
    'budget', execution_budget,
    'input', jsonb_build_object(
      'kind', input_kind,
      'domainJobId', task_record.scan_job_id
    )
  );
end;
$$;

revoke all on function public.claim_runtime_worker_task(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_runtime_worker_task(uuid)
  to service_role;
