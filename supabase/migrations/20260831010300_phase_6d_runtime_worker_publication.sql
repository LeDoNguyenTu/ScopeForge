create or replace function public.get_runtime_worker_finalization_context(
  target_worker_id uuid,
  target_task_id uuid,
  target_attempt_id uuid,
  target_lease_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  task_record private.worker_tasks%rowtype;
  runtime_task private.runtime_worker_tasks%rowtype;
  attempt_record private.worker_attempts%rowtype;
  job_record public.scan_jobs%rowtype;
  supplied_hash text;
begin
  if target_worker_id is null
     or target_task_id is null
     or target_attempt_id is null
     or target_lease_token is null
     or target_lease_token !~ '^[a-f0-9]{64}$' then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  supplied_hash := encode(
    extensions.digest(decode(target_lease_token, 'hex'), 'sha256'),
    'hex'
  );

  select * into task_record
    from private.worker_tasks
   where id = target_task_id
   for update;

  select * into runtime_task
    from private.runtime_worker_tasks
   where task_id = target_task_id;

  select * into attempt_record
    from private.worker_attempts
   where id = target_attempt_id
     and task_id = target_task_id
   for update;

  if task_record.id is null
     or runtime_task.task_id is null
     or attempt_record.id is null
     or attempt_record.worker_id <> target_worker_id
     or attempt_record.lease_token_hash <> supplied_hash
     or task_record.execution_class not in (
       'passive_runtime_observation_v1',
       'active_cors_validation_v1'
     ) then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  if runtime_task.scan_job_id <> task_record.scan_job_id
     or runtime_task.workspace_id <> task_record.workspace_id
     or runtime_task.asset_id <> task_record.asset_id then
    raise exception 'RUNTIME_WORKER_TASK_INVALID';
  end if;

  select * into job_record
    from public.scan_jobs
   where id = runtime_task.scan_job_id
     and workspace_id = runtime_task.workspace_id
     and asset_id = runtime_task.asset_id
   for update;

  if job_record.id is null
     or not (
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

  if attempt_record.finished_at is null then
    if task_record.state <> 'leased'
       or job_record.status <> 'running'::public.scan_job_status then
      raise exception 'WORKER_JOB_STATE_CONFLICT';
    end if;
  end if;

  return jsonb_build_object(
    'taskId', task_record.id,
    'attemptId', attempt_record.id,
    'executionClass', task_record.execution_class,
    'domainJobId', runtime_task.scan_job_id,
    'workspaceId', runtime_task.workspace_id,
    'assetId', runtime_task.asset_id,
    'cancelRequested', job_record.cancel_requested_at is not null,
    'leaseExpiresAt', attempt_record.lease_expires_at,
    'finishedAt', attempt_record.finished_at,
    'priorOutcome', attempt_record.outcome,
    'priorTerminalDigest', attempt_record.terminal_payload_digest
  );
end;
$$;

create or replace function public.finalize_runtime_worker_attempt(
  target_worker_id uuid,
  target_task_id uuid,
  target_attempt_id uuid,
  target_lease_token text,
  target_execution_class text,
  target_terminal_digest text,
  target_outcome text,
  target_failure_code text,
  target_request_count integer,
  target_redirect_count integer,
  target_finding_count integer,
  target_wall_time_ms integer,
  target_cpu_time_ms integer,
  target_peak_memory_bytes bigint,
  target_input_bytes bigint,
  target_output_bytes bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  task_record private.worker_tasks%rowtype;
  runtime_task private.runtime_worker_tasks%rowtype;
  attempt_record private.worker_attempts%rowtype;
  job_record public.scan_jobs%rowtype;
  supplied_hash text;
  effective_outcome text;
  finish_now timestamptz := now();
begin
  if target_worker_id is null
     or target_task_id is null
     or target_attempt_id is null
     or target_lease_token is null
     or target_lease_token !~ '^[a-f0-9]{64}$'
     or target_terminal_digest is null
     or target_terminal_digest !~ '^[a-f0-9]{64}$'
     or target_execution_class not in (
       'passive_runtime_observation_v1',
       'active_cors_validation_v1'
     )
     or target_outcome not in ('succeeded', 'failed', 'cancelled')
     or target_request_count is null or target_request_count < 0
     or target_redirect_count is null or target_redirect_count < 0
     or target_finding_count is null or target_finding_count < 0
     or target_wall_time_ms is null or target_wall_time_ms < 0
     or target_cpu_time_ms is null or target_cpu_time_ms < 0
     or target_peak_memory_bytes is null or target_peak_memory_bytes < 0
     or target_input_bytes is null or target_input_bytes < 0
     or target_output_bytes is null or target_output_bytes < 0 then
    raise exception 'RUNTIME_WORKER_TASK_INVALID';
  end if;

  if target_outcome = 'failed' then
    if target_failure_code is null or char_length(target_failure_code) not between 1 and 64 then
      raise exception 'RUNTIME_WORKER_TASK_INVALID';
    end if;
  elsif target_failure_code is not null then
    raise exception 'RUNTIME_WORKER_TASK_INVALID';
  end if;

  if target_execution_class = 'passive_runtime_observation_v1' then
    if target_request_count > 4 or target_redirect_count > 3
       or target_wall_time_ms > 30000
       or target_cpu_time_ms > 15000
       or target_peak_memory_bytes > 268435456
       or target_input_bytes > 65536
       or target_output_bytes > 131072 then
      raise exception 'RUNTIME_WORKER_BUDGET_EXCEEDED';
    end if;
  else
    if target_request_count > 1 or target_redirect_count <> 0
       or target_wall_time_ms > 20000
       or target_cpu_time_ms > 10000
       or target_peak_memory_bytes > 268435456
       or target_input_bytes > 32768
       or target_output_bytes > 65536 then
      raise exception 'RUNTIME_WORKER_BUDGET_EXCEEDED';
    end if;
    if target_outcome = 'succeeded' and target_request_count <> 1 then
      raise exception 'RUNTIME_WORKER_TASK_INVALID';
    end if;
  end if;

  supplied_hash := encode(
    extensions.digest(decode(target_lease_token, 'hex'), 'sha256'),
    'hex'
  );

  select * into task_record
    from private.worker_tasks
   where id = target_task_id
   for update;
  select * into runtime_task
    from private.runtime_worker_tasks
   where task_id = target_task_id;
  select * into attempt_record
    from private.worker_attempts
   where id = target_attempt_id
     and task_id = target_task_id
   for update;

  if task_record.id is null
     or runtime_task.task_id is null
     or attempt_record.id is null
     or attempt_record.worker_id <> target_worker_id
     or attempt_record.lease_token_hash <> supplied_hash
     or task_record.execution_class <> target_execution_class then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  if attempt_record.finished_at is not null then
    if attempt_record.terminal_payload_digest = target_terminal_digest
       and attempt_record.outcome = target_outcome then
      return jsonb_build_object(
        'outcome', attempt_record.outcome,
        'replayed', true
      );
    end if;
    raise exception 'WORKER_TERMINAL_CONFLICT';
  end if;

  if task_record.state <> 'leased' then
    raise exception 'WORKER_JOB_STATE_CONFLICT';
  end if;

  select * into job_record
    from public.scan_jobs
   where id = runtime_task.scan_job_id
     and workspace_id = runtime_task.workspace_id
     and asset_id = runtime_task.asset_id
   for update;

  if job_record.id is null
     or job_record.status <> 'running'::public.scan_job_status
     or not (
       (target_execution_class = 'passive_runtime_observation_v1'
        and runtime_task.domain_job_kind = 'passive_runtime'::public.scan_job_kind
        and job_record.job_kind = 'passive_runtime'::public.scan_job_kind)
       or
       (target_execution_class = 'active_cors_validation_v1'
        and runtime_task.domain_job_kind = 'active_validation'::public.scan_job_kind
        and job_record.job_kind = 'active_validation'::public.scan_job_kind)
     ) then
    raise exception 'WORKER_JOB_STATE_CONFLICT';
  end if;

  effective_outcome := case
    when job_record.cancel_requested_at is not null then 'cancelled'
    else target_outcome
  end;

  if effective_outcome = 'succeeded' then
    update public.scan_jobs
       set status = 'succeeded'::public.scan_job_status,
           request_count = target_request_count,
           redirect_count = target_redirect_count,
           finding_count = target_finding_count,
           failure_code = null,
           blocked_reason = null,
           finished_at = finish_now
     where id = job_record.id
       and status = 'running'::public.scan_job_status
       and cancel_requested_at is null;
    if not found then
      raise exception 'WORKER_JOB_STATE_CONFLICT';
    end if;
  elsif effective_outcome = 'cancelled' then
    update public.scan_jobs
       set status = 'cancelled'::public.scan_job_status,
           failure_code = null,
           finished_at = finish_now
     where id = job_record.id
       and status = 'running'::public.scan_job_status;
  else
    update public.scan_jobs
       set status = 'failed'::public.scan_job_status,
           failure_code = target_failure_code,
           finished_at = finish_now
     where id = job_record.id
       and status = 'running'::public.scan_job_status;
  end if;

  update private.worker_attempts
     set finished_at = finish_now,
         outcome = effective_outcome,
         failure_code = case when effective_outcome = 'failed' then target_failure_code else null end,
         terminal_payload_digest = target_terminal_digest,
         wall_time_ms = target_wall_time_ms,
         cpu_time_ms = target_cpu_time_ms,
         peak_memory_bytes = target_peak_memory_bytes,
         input_bytes = target_input_bytes,
         output_bytes = target_output_bytes
   where id = attempt_record.id
     and finished_at is null;
  if not found then
    raise exception 'WORKER_TERMINAL_CONFLICT';
  end if;

  update private.worker_tasks
     set state = case when effective_outcome = 'cancelled' then 'cancelled' else 'completed' end,
         updated_at = finish_now
   where id = task_record.id
     and state = 'leased';
  if not found then
    raise exception 'WORKER_JOB_STATE_CONFLICT';
  end if;

  perform private.record_worker_event(
    'worker.attempt_finalized',
    task_record.workspace_id,
    target_worker_id,
    task_record.id,
    jsonb_build_object(
      'attemptId', attempt_record.id,
      'executionClass', target_execution_class,
      'outcome', effective_outcome
    )
  );

  return jsonb_build_object(
    'outcome', effective_outcome,
    'replayed', false
  );
end;
$$;

revoke all on function public.get_runtime_worker_finalization_context(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_runtime_worker_finalization_context(uuid, uuid, uuid, text)
  to service_role;

revoke all on function public.finalize_runtime_worker_attempt(
  uuid, uuid, uuid, text, text, text, text, text,
  integer, integer, integer, integer, integer, bigint, bigint, bigint
) from public, anon, authenticated, service_role;
grant execute on function public.finalize_runtime_worker_attempt(
  uuid, uuid, uuid, text, text, text, text, text,
  integer, integer, integer, integer, integer, bigint, bigint, bigint
) to service_role;
