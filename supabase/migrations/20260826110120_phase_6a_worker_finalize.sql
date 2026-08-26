create or replace function public.finalize_worker_attempt(
  target_worker_id uuid,
  target_task_id uuid,
  target_attempt_id uuid,
  target_lease_token text,
  target_terminal_outcome text,
  target_failure_code text,
  target_terminal_payload_digest text,
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
  worker_record private.worker_nodes%rowtype;
  task_record private.worker_tasks%rowtype;
  attempt_record private.worker_attempts%rowtype;
  job_record public.scan_jobs%rowtype;
  finalize_now timestamptz := now();
  calculated_hash text;
  effective_outcome text;
  effective_failure_code text;
  retry_delay interval;
  replayed boolean := false;
begin
  if target_lease_token is null or target_lease_token !~ '^[a-f0-9]{64}$' then
    raise exception 'WORKER_LEASE_INVALID';
  end if;
  if target_terminal_payload_digest is null
     or target_terminal_payload_digest !~ '^[a-f0-9]{64}$' then
    raise exception 'WORKER_TERMINAL_INVALID';
  end if;
  if target_terminal_outcome not in ('succeeded', 'failed', 'cancelled') then
    raise exception 'WORKER_TERMINAL_INVALID';
  end if;
  if target_wall_time_ms is null or target_wall_time_ms < 0 or target_wall_time_ms > 30000
     or target_cpu_time_ms is null or target_cpu_time_ms < 0 or target_cpu_time_ms > 20000
     or target_peak_memory_bytes is null or target_peak_memory_bytes < 0 or target_peak_memory_bytes > 268435456
     or target_input_bytes is null or target_input_bytes < 0 or target_input_bytes > 10485760
     or target_output_bytes is null or target_output_bytes > 1048576 then
    raise exception 'WORKER_BUDGET_EXCEEDED';
  end if;

  if target_terminal_outcome = 'failed' then
    if target_failure_code not in (
      'WORKER_LEASE_EXPIRED',
      'WORKER_LOST',
      'WORKER_BUDGET_EXCEEDED',
      'WORKER_OUTPUT_INVALID',
      'WORKER_EXECUTION_FAILED',
      'WORKER_CLASS_UNAVAILABLE'
    ) then
      raise exception 'WORKER_TERMINAL_INVALID';
    end if;
  elsif target_failure_code is not null then
    raise exception 'WORKER_TERMINAL_INVALID';
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
     or attempt_record.lease_token_hash <> calculated_hash then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  if attempt_record.finished_at is not null then
    if attempt_record.terminal_payload_digest = target_terminal_payload_digest
       and attempt_record.outcome in ('succeeded', 'failed', 'cancelled') then
      replayed := true;
      return jsonb_build_object(
        'taskId', target_task_id,
        'attemptId', target_attempt_id,
        'outcome', attempt_record.outcome,
        'replayed', replayed
      );
    end if;
    raise exception 'WORKER_TERMINAL_CONFLICT';
  end if;

  select * into worker_record
  from private.worker_nodes
  where id = target_worker_id
  for update;
  if worker_record.id is null or worker_record.disabled_at is not null then
    raise exception 'WORKER_DISABLED';
  end if;

  select * into task_record
  from private.worker_tasks
  where id = target_task_id
  for update;
  if task_record.id is null
     or task_record.state <> 'leased'
     or attempt_record.lease_expires_at <= finalize_now then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  select * into job_record
  from public.scan_jobs
  where id = task_record.scan_job_id
    and workspace_id = task_record.workspace_id
    and asset_id = task_record.asset_id
  for update;
  if job_record.id is null then
    raise exception 'WORKER_JOB_NOT_AVAILABLE';
  end if;

  if job_record.cancel_requested_at is not null
     or job_record.status = 'cancelled'::public.scan_job_status
     or target_terminal_outcome = 'cancelled' then
    effective_outcome := 'cancelled';
    effective_failure_code := 'WORKER_CANCELLED';
  else
    effective_outcome := target_terminal_outcome;
    effective_failure_code := target_failure_code;
  end if;

  update private.worker_attempts
  set finished_at = finalize_now,
      outcome = effective_outcome,
      failure_code = effective_failure_code,
      terminal_payload_digest = target_terminal_payload_digest,
      wall_time_ms = target_wall_time_ms,
      cpu_time_ms = target_cpu_time_ms,
      peak_memory_bytes = target_peak_memory_bytes,
      input_bytes = target_input_bytes,
      output_bytes = target_output_bytes
  where id = attempt_record.id
  returning * into attempt_record;

  if effective_outcome = 'cancelled' then
    update private.worker_tasks
    set state = 'cancelled', updated_at = finalize_now
    where id = task_record.id;

    if job_record.status in ('queued'::public.scan_job_status, 'running'::public.scan_job_status) then
      update public.scan_jobs
      set status = 'cancelled'::public.scan_job_status,
          finished_at = finalize_now,
          failure_code = null
      where id = job_record.id;
    end if;

    perform private.record_worker_event(
      'worker.cancelled', task_record.workspace_id, worker_record.id, task_record.id,
      jsonb_build_object('attemptId', attempt_record.id)
    );
  elsif effective_outcome = 'succeeded' then
    update private.worker_tasks
    set state = 'completed', updated_at = finalize_now
    where id = task_record.id;

    update public.scan_jobs
    set status = 'succeeded'::public.scan_job_status,
        finished_at = finalize_now,
        failure_code = null,
        request_count = 0,
        redirect_count = 0,
        finding_count = 0
    where id = job_record.id
      and status = 'running'::public.scan_job_status;

    if not found then
      raise exception 'WORKER_JOB_STATE_CONFLICT';
    end if;

    perform private.record_worker_event(
      'worker.succeeded', task_record.workspace_id, worker_record.id, task_record.id,
      jsonb_build_object('attemptId', attempt_record.id)
    );
  else
    if task_record.attempt_count < task_record.max_attempts
       and task_record.absolute_deadline_at > finalize_now then
      retry_delay := case task_record.attempt_count
        when 1 then interval '15 seconds'
        when 2 then interval '60 seconds'
        else null
      end;

      if retry_delay is not null
         and finalize_now + retry_delay < task_record.absolute_deadline_at then
        update private.worker_tasks
        set state = 'retry_wait',
            available_at = finalize_now + retry_delay,
            updated_at = finalize_now
        where id = task_record.id;

        perform private.record_worker_event(
          'worker.retry_scheduled', task_record.workspace_id, worker_record.id, task_record.id,
          jsonb_build_object(
            'attemptId', attempt_record.id,
            'availableAt', finalize_now + retry_delay
          )
        );
      else
        update private.worker_tasks
        set state = 'dead_letter', updated_at = finalize_now
        where id = task_record.id;

        update public.scan_jobs
        set status = 'failed'::public.scan_job_status,
            finished_at = finalize_now,
            failure_code = 'WORKER_ATTEMPTS_EXHAUSTED'
        where id = job_record.id
          and status = 'running'::public.scan_job_status;

        perform private.record_worker_event(
          'worker.dead_lettered', task_record.workspace_id, worker_record.id, task_record.id,
          jsonb_build_object('attemptId', attempt_record.id, 'reason', 'deadline')
        );
      end if;
    else
      update private.worker_tasks
      set state = 'dead_letter', updated_at = finalize_now
      where id = task_record.id;

      update public.scan_jobs
      set status = 'failed'::public.scan_job_status,
          finished_at = finalize_now,
          failure_code = 'WORKER_ATTEMPTS_EXHAUSTED'
      where id = job_record.id
        and status = 'running'::public.scan_job_status;

      perform private.record_worker_event(
        'worker.dead_lettered', task_record.workspace_id, worker_record.id, task_record.id,
        jsonb_build_object('attemptId', attempt_record.id, 'reason', 'attempts')
      );
    end if;
  end if;

  update private.worker_nodes
  set last_seen_at = greatest(coalesce(last_seen_at, finalize_now), finalize_now)
  where id = worker_record.id;

  return jsonb_build_object(
    'taskId', task_record.id,
    'attemptId', attempt_record.id,
    'outcome', effective_outcome,
    'replayed', replayed
  );
end;
$$;

revoke all on function public.finalize_worker_attempt(
  uuid, uuid, uuid, text, text, text, text, integer, integer, bigint, bigint, bigint
) from public, anon, authenticated;
grant execute on function public.finalize_worker_attempt(
  uuid, uuid, uuid, text, text, text, text, integer, integer, bigint, bigint, bigint
) to service_role;
