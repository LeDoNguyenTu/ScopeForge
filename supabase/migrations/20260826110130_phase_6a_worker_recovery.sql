create or replace function public.recover_expired_worker_attempts(
  target_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  task_record private.worker_tasks%rowtype;
  attempt_record private.worker_attempts%rowtype;
  job_record public.scan_jobs%rowtype;
  retry_delay interval;
  recovered integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('scopeforge-worker-recovery-v1', 0));

  for task_record in
    select t.*
    from private.worker_tasks t
    join public.scan_jobs j
      on j.id = t.scan_job_id
     and j.workspace_id = t.workspace_id
     and j.asset_id = t.asset_id
    where t.state in ('queued', 'retry_wait')
      and j.cancel_requested_at is not null
    order by t.created_at asc, t.id asc
    for update of t skip locked
  loop
    select * into job_record
    from public.scan_jobs
    where id = task_record.scan_job_id
      and workspace_id = task_record.workspace_id
      and asset_id = task_record.asset_id
    for update;

    update private.worker_tasks
    set state = 'cancelled', updated_at = target_now
    where id = task_record.id;

    if job_record.status in ('queued'::public.scan_job_status, 'running'::public.scan_job_status) then
      update public.scan_jobs
      set status = 'cancelled'::public.scan_job_status,
          finished_at = target_now,
          failure_code = null
      where id = job_record.id;
    end if;

    perform private.record_worker_event(
      'worker.cancelled', task_record.workspace_id, null, task_record.id,
      jsonb_build_object('reason', 'cancel_before_claim')
    );
    recovered := recovered + 1;
  end loop;

  for attempt_record in
    select a.*
    from private.worker_attempts a
    join private.worker_tasks t on t.id = a.task_id
    where a.finished_at is null
      and a.lease_expires_at <= target_now
      and t.state = 'leased'
    order by a.lease_expires_at asc, a.id asc
    for update of a skip locked
  loop
    select * into task_record
    from private.worker_tasks
    where id = attempt_record.task_id
    for update;

    select * into job_record
    from public.scan_jobs
    where id = task_record.scan_job_id
      and workspace_id = task_record.workspace_id
      and asset_id = task_record.asset_id
    for update;

    if job_record.cancel_requested_at is not null
       or job_record.status = 'cancelled'::public.scan_job_status then
      update private.worker_attempts
      set finished_at = target_now,
          outcome = 'cancelled',
          failure_code = 'WORKER_CANCELLED'
      where id = attempt_record.id;

      update private.worker_tasks
      set state = 'cancelled', updated_at = target_now
      where id = task_record.id;

      if job_record.status in ('queued'::public.scan_job_status, 'running'::public.scan_job_status) then
        update public.scan_jobs
        set status = 'cancelled'::public.scan_job_status,
            finished_at = target_now,
            failure_code = null
        where id = job_record.id;
      end if;

      perform private.record_worker_event(
        'worker.cancelled', task_record.workspace_id, attempt_record.worker_id, task_record.id,
        jsonb_build_object(
          'attemptId', attempt_record.id,
          'reason', 'lease_expired_after_cancel'
        )
      );
    else
      update private.worker_attempts
      set finished_at = target_now,
          outcome = 'lease_expired',
          failure_code = 'WORKER_LEASE_EXPIRED'
      where id = attempt_record.id;

      if task_record.absolute_deadline_at <= target_now then
        update private.worker_tasks
        set state = 'dead_letter', updated_at = target_now
        where id = task_record.id;

        update public.scan_jobs
        set status = 'failed'::public.scan_job_status,
            finished_at = target_now,
            failure_code = 'WORKER_BUDGET_EXCEEDED'
        where id = job_record.id
          and status = 'running'::public.scan_job_status;

        perform private.record_worker_event(
          'worker.dead_lettered', task_record.workspace_id, attempt_record.worker_id, task_record.id,
          jsonb_build_object('attemptId', attempt_record.id, 'reason', 'deadline')
        );
      elsif task_record.attempt_count < task_record.max_attempts then
        retry_delay := case task_record.attempt_count
          when 1 then interval '15 seconds'
          when 2 then interval '60 seconds'
          else null
        end;

        if retry_delay is not null
           and target_now + retry_delay < task_record.absolute_deadline_at then
          update private.worker_tasks
          set state = 'retry_wait',
              available_at = target_now + retry_delay,
              updated_at = target_now
          where id = task_record.id;

          perform private.record_worker_event(
            'worker.lease_expired', task_record.workspace_id, attempt_record.worker_id, task_record.id,
            jsonb_build_object('attemptId', attempt_record.id)
          );
          perform private.record_worker_event(
            'worker.retry_scheduled', task_record.workspace_id, attempt_record.worker_id, task_record.id,
            jsonb_build_object('availableAt', target_now + retry_delay)
          );
        else
          update private.worker_tasks
          set state = 'dead_letter', updated_at = target_now
          where id = task_record.id;

          update public.scan_jobs
          set status = 'failed'::public.scan_job_status,
              finished_at = target_now,
              failure_code = 'WORKER_ATTEMPTS_EXHAUSTED'
          where id = job_record.id
            and status = 'running'::public.scan_job_status;

          perform private.record_worker_event(
            'worker.dead_lettered', task_record.workspace_id, attempt_record.worker_id, task_record.id,
            jsonb_build_object('attemptId', attempt_record.id, 'reason', 'retry_window')
          );
        end if;
      else
        update private.worker_tasks
        set state = 'dead_letter', updated_at = target_now
        where id = task_record.id;

        update public.scan_jobs
        set status = 'failed'::public.scan_job_status,
            finished_at = target_now,
            failure_code = 'WORKER_ATTEMPTS_EXHAUSTED'
        where id = job_record.id
          and status = 'running'::public.scan_job_status;

        perform private.record_worker_event(
          'worker.dead_lettered', task_record.workspace_id, attempt_record.worker_id, task_record.id,
          jsonb_build_object('attemptId', attempt_record.id, 'reason', 'attempts')
        );
      end if;
    end if;

    recovered := recovered + 1;
  end loop;

  return recovered;
end;
$$;

revoke all on function public.recover_expired_worker_attempts(timestamptz)
  from public, anon, authenticated;
grant execute on function public.recover_expired_worker_attempts(timestamptz)
  to service_role;
