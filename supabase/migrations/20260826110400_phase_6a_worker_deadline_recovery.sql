create or replace function private.guard_worker_task_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.scan_job_id is distinct from old.scan_job_id
     or new.workspace_id is distinct from old.workspace_id
     or new.asset_id is distinct from old.asset_id
     or new.execution_class is distinct from old.execution_class
     or new.priority is distinct from old.priority
     or new.max_attempts is distinct from old.max_attempts
     or new.absolute_deadline_at is distinct from old.absolute_deadline_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Worker task identity fields are immutable';
  end if;

  if new.attempt_count < old.attempt_count or new.attempt_count > old.attempt_count + 1 then
    raise exception 'Worker task attempt count transition is invalid';
  end if;

  if new.state is distinct from old.state then
    if old.state = 'queued' and new.state not in ('leased', 'dead_letter', 'cancelled') then
      raise exception 'Invalid worker task state transition';
    elsif old.state = 'leased' and new.state not in ('retry_wait', 'completed', 'dead_letter', 'cancelled') then
      raise exception 'Invalid worker task state transition';
    elsif old.state = 'retry_wait' and new.state not in ('leased', 'dead_letter', 'cancelled') then
      raise exception 'Invalid worker task state transition';
    elsif old.state in ('completed', 'dead_letter', 'cancelled') then
      raise exception 'Worker task terminal states are immutable';
    end if;
  elsif old.state in ('completed', 'dead_letter', 'cancelled')
        and row(new.*) is distinct from row(old.*) then
    raise exception 'Worker task terminal states are immutable';
  end if;

  if new.updated_at < old.updated_at then
    raise exception 'Worker task update timestamp cannot move backwards';
  end if;

  return new;
end;
$$;

create or replace function private.recover_expired_unleased_worker_tasks(
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
    where t.state in ('queued', 'retry_wait')
      and t.absolute_deadline_at <= target_now
      and j.job_kind = 'worker_foundation_probe'::public.scan_job_kind
      and j.status in ('queued'::public.scan_job_status, 'running'::public.scan_job_status)
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
    set state = 'dead_letter', updated_at = target_now
    where id = task_record.id;

    if job_record.status = 'queued'::public.scan_job_status then
      update public.scan_jobs
      set status = 'running'::public.scan_job_status,
          started_at = coalesce(started_at, target_now)
      where id = job_record.id
        and status = 'queued'::public.scan_job_status;
    end if;

    update public.scan_jobs
    set status = 'failed'::public.scan_job_status,
        finished_at = target_now,
        failure_code = 'WORKER_BUDGET_EXCEEDED'
    where id = job_record.id
      and status = 'running'::public.scan_job_status;

    perform private.record_worker_event(
      'worker.dead_lettered',
      task_record.workspace_id,
      null,
      task_record.id,
      jsonb_build_object('reason', 'absolute_deadline_unleased')
    );

    recovered := recovered + 1;
  end loop;

  return recovered;
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
  unleased_count integer;
  leased_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('scopeforge-worker-recovery-v1', 0));
  unleased_count := private.recover_expired_unleased_worker_tasks(target_now);
  leased_count := public.recover_expired_worker_attempts(target_now);
  return unleased_count + leased_count;
end;
$$;

revoke all on function public.recover_expired_worker_attempts(timestamptz) from service_role;
revoke all on function public.recover_worker_state(timestamptz) from public, anon, authenticated;
grant execute on function public.recover_worker_state(timestamptz) to service_role;
