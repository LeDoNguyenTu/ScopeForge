create or replace function private.recover_expired_runtime_worker_tasks(
  target_now timestamptz
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  task_record private.worker_tasks%rowtype;
  job_record public.scan_jobs%rowtype;
  recovered integer := 0;
begin
  for task_record in
    select t.*
      from private.worker_tasks t
      join public.scan_jobs j
        on j.id = t.scan_job_id
       and j.workspace_id = t.workspace_id
       and j.asset_id = t.asset_id
     where t.execution_class in (
       'passive_runtime_observation_v1',
       'active_cors_validation_v1'
     )
       and t.state in ('queued', 'retry_wait')
       and t.absolute_deadline_at <= target_now
       and j.status in ('queued'::public.scan_job_status, 'running'::public.scan_job_status)
       and j.cancel_requested_at is null
     order by t.absolute_deadline_at asc, t.id asc
     for update of t skip locked
  loop
    select * into job_record
      from public.scan_jobs
     where id = task_record.scan_job_id
       and workspace_id = task_record.workspace_id
       and asset_id = task_record.asset_id
     for update;

    update private.worker_tasks
       set state = 'dead_letter',
           updated_at = target_now
     where id = task_record.id
       and state in ('queued', 'retry_wait');

    if job_record.status = 'queued'::public.scan_job_status then
      update public.scan_jobs
         set status = 'blocked'::public.scan_job_status,
             finished_at = target_now,
             failure_code = 'RUNTIME_WORKER_EXECUTION_FAILED',
             blocked_reason = 'Runtime worker attempt expired before preparation completed.'
       where id = job_record.id
         and status = 'queued'::public.scan_job_status
         and cancel_requested_at is null;
    elsif job_record.status = 'running'::public.scan_job_status then
      update public.scan_jobs
         set status = 'failed'::public.scan_job_status,
             finished_at = target_now,
             failure_code = 'RUNTIME_WORKER_BUDGET_EXCEEDED'
       where id = job_record.id
         and status = 'running'::public.scan_job_status
         and cancel_requested_at is null;
    end if;

    perform private.record_worker_event(
      'worker.dead_lettered',
      task_record.workspace_id,
      null,
      task_record.id,
      jsonb_build_object('reason', 'runtime_absolute_deadline_unleased')
    );

    recovered := recovered + 1;
  end loop;

  return recovered;
end;
$$;

create or replace function private.reconcile_dead_letter_runtime_worker_jobs(
  target_now timestamptz
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  task_record private.worker_tasks%rowtype;
  reconciled integer := 0;
begin
  for task_record in
    select t.*
      from private.worker_tasks t
      join public.scan_jobs j
        on j.id = t.scan_job_id
       and j.workspace_id = t.workspace_id
       and j.asset_id = t.asset_id
     where t.execution_class in (
       'passive_runtime_observation_v1',
       'active_cors_validation_v1'
     )
       and t.state = 'dead_letter'
       and j.status = 'queued'::public.scan_job_status
       and j.cancel_requested_at is null
     order by t.updated_at asc, t.id asc
     for update of t skip locked
  loop
    update public.scan_jobs
       set status = 'blocked'::public.scan_job_status,
           finished_at = target_now,
           failure_code = 'RUNTIME_WORKER_EXECUTION_FAILED',
           blocked_reason = 'Runtime worker attempt expired before preparation completed.'
     where id = task_record.scan_job_id
       and workspace_id = task_record.workspace_id
       and asset_id = task_record.asset_id
       and status = 'queued'::public.scan_job_status
       and cancel_requested_at is null;

    if found then
      reconciled := reconciled + 1;
    end if;
  end loop;

  return reconciled;
end;
$$;

create or replace function public.recover_worker_state(
  target_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  leased_count integer;
  unleased_count integer;
  runtime_unleased_count integer;
  runtime_reconciled_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('scopeforge-worker-recovery-v1', 0));

  leased_count := public.recover_expired_worker_attempts_leased_only(target_now);
  unleased_count := private.recover_expired_unleased_worker_tasks(target_now);
  runtime_unleased_count := private.recover_expired_runtime_worker_tasks(target_now);
  runtime_reconciled_count := private.reconcile_dead_letter_runtime_worker_jobs(target_now);

  return leased_count + unleased_count + runtime_unleased_count + runtime_reconciled_count;
end;
$$;

revoke all on function private.recover_expired_runtime_worker_tasks(timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.reconcile_dead_letter_runtime_worker_jobs(timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.recover_worker_state(timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.recover_worker_state(timestamptz)
  to service_role;
