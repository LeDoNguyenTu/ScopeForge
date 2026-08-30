create or replace function public.enqueue_passive_runtime_worker_task(
  target_workspace_id uuid,
  target_scan_job_id uuid,
  target_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record public.scan_jobs%rowtype;
  task_record private.worker_tasks%rowtype;
  request_now timestamptz := now();
begin
  if target_workspace_id is null
     or target_scan_job_id is null
     or target_actor_id is null then
    raise exception 'RUNTIME_WORKER_TASK_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('scopeforge-runtime-worker-workspace:' || target_workspace_id::text, 0)
  );

  if not exists (
    select 1
      from public.workspace_members
     where workspace_id = target_workspace_id
       and user_id = target_actor_id
  ) then
    raise exception 'RUNTIME_WORKER_ACCESS_DENIED';
  end if;

  select * into job_record
    from public.scan_jobs
   where id = target_scan_job_id
     and workspace_id = target_workspace_id
   for update;

  if job_record.id is null
     or job_record.job_kind <> 'passive_runtime'::public.scan_job_kind
     or job_record.status <> 'queued'::public.scan_job_status
     or job_record.cancel_requested_at is not null
     or job_record.requested_by is distinct from target_actor_id then
    raise exception 'RUNTIME_WORKER_TASK_INVALID';
  end if;

  if exists (
    select 1
      from private.worker_tasks active_task
      join public.scan_jobs active_job
        on active_job.id = active_task.scan_job_id
       and active_job.workspace_id = active_task.workspace_id
       and active_job.asset_id = active_task.asset_id
     where active_task.workspace_id = target_workspace_id
       and active_task.execution_class in (
         'passive_runtime_observation_v1',
         'active_cors_validation_v1'
       )
       and active_task.state in ('queued', 'leased', 'retry_wait')
       and active_task.absolute_deadline_at > request_now
       and active_job.status = 'queued'::public.scan_job_status
       and active_job.cancel_requested_at is null
  ) then
    raise exception 'RUNTIME_WORKER_ACTIVE_LIMIT';
  end if;

  insert into private.worker_tasks (
    scan_job_id,
    workspace_id,
    asset_id,
    execution_class,
    state,
    priority,
    available_at,
    attempt_count,
    max_attempts,
    absolute_deadline_at
  ) values (
    job_record.id,
    job_record.workspace_id,
    job_record.asset_id,
    'passive_runtime_observation_v1',
    'queued',
    0,
    request_now,
    0,
    1,
    request_now + interval '30 seconds'
  )
  returning * into task_record;

  insert into private.runtime_worker_tasks (
    task_id,
    scan_job_id,
    workspace_id,
    asset_id,
    requested_by,
    domain_job_kind,
    schema_version,
    created_at
  ) values (
    task_record.id,
    job_record.id,
    job_record.workspace_id,
    job_record.asset_id,
    target_actor_id,
    'passive_runtime'::public.scan_job_kind,
    1,
    request_now
  );

  perform private.record_worker_event(
    'worker.task_queued',
    task_record.workspace_id,
    null,
    task_record.id,
    jsonb_build_object(
      'scanJobId', task_record.scan_job_id,
      'executionClass', task_record.execution_class
    )
  );

  return jsonb_build_object(
    'scanJobId', job_record.id,
    'taskId', task_record.id,
    'executionClass', task_record.execution_class,
    'absoluteDeadlineAt', task_record.absolute_deadline_at
  );
end;
$$;

create or replace function public.enqueue_active_cors_worker_task(
  target_workspace_id uuid,
  target_scan_job_id uuid,
  target_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record public.scan_jobs%rowtype;
  task_record private.worker_tasks%rowtype;
  request_now timestamptz := now();
begin
  if target_workspace_id is null
     or target_scan_job_id is null
     or target_actor_id is null then
    raise exception 'RUNTIME_WORKER_TASK_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('scopeforge-runtime-worker-workspace:' || target_workspace_id::text, 0)
  );

  if not exists (
    select 1
      from public.workspace_members
     where workspace_id = target_workspace_id
       and user_id = target_actor_id
       and role::text in ('owner', 'admin')
  ) then
    raise exception 'RUNTIME_WORKER_ACCESS_DENIED';
  end if;

  select * into job_record
    from public.scan_jobs
   where id = target_scan_job_id
     and workspace_id = target_workspace_id
   for update;

  if job_record.id is null
     or job_record.job_kind <> 'active_validation'::public.scan_job_kind
     or job_record.status <> 'queued'::public.scan_job_status
     or job_record.cancel_requested_at is not null
     or job_record.requested_by is distinct from target_actor_id then
    raise exception 'RUNTIME_WORKER_TASK_INVALID';
  end if;

  if exists (
    select 1
      from private.worker_tasks active_task
      join public.scan_jobs active_job
        on active_job.id = active_task.scan_job_id
       and active_job.workspace_id = active_task.workspace_id
       and active_job.asset_id = active_task.asset_id
     where active_task.workspace_id = target_workspace_id
       and active_task.execution_class in (
         'passive_runtime_observation_v1',
         'active_cors_validation_v1'
       )
       and active_task.state in ('queued', 'leased', 'retry_wait')
       and active_task.absolute_deadline_at > request_now
       and active_job.status = 'queued'::public.scan_job_status
       and active_job.cancel_requested_at is null
  ) then
    raise exception 'RUNTIME_WORKER_ACTIVE_LIMIT';
  end if;

  insert into private.worker_tasks (
    scan_job_id,
    workspace_id,
    asset_id,
    execution_class,
    state,
    priority,
    available_at,
    attempt_count,
    max_attempts,
    absolute_deadline_at
  ) values (
    job_record.id,
    job_record.workspace_id,
    job_record.asset_id,
    'active_cors_validation_v1',
    'queued',
    0,
    request_now,
    0,
    1,
    request_now + interval '20 seconds'
  )
  returning * into task_record;

  insert into private.runtime_worker_tasks (
    task_id,
    scan_job_id,
    workspace_id,
    asset_id,
    requested_by,
    domain_job_kind,
    schema_version,
    created_at
  ) values (
    task_record.id,
    job_record.id,
    job_record.workspace_id,
    job_record.asset_id,
    target_actor_id,
    'active_validation'::public.scan_job_kind,
    1,
    request_now
  );

  perform private.record_worker_event(
    'worker.task_queued',
    task_record.workspace_id,
    null,
    task_record.id,
    jsonb_build_object(
      'scanJobId', task_record.scan_job_id,
      'executionClass', task_record.execution_class
    )
  );

  return jsonb_build_object(
    'scanJobId', job_record.id,
    'taskId', task_record.id,
    'executionClass', task_record.execution_class,
    'absoluteDeadlineAt', task_record.absolute_deadline_at
  );
end;
$$;
