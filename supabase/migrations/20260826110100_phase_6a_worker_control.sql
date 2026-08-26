create table private.worker_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  worker_id uuid references private.worker_nodes(id),
  task_id uuid references private.worker_tasks(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 1 and 100),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 2048
  ),
  created_at timestamptz not null default now()
);

create index worker_events_created_idx
  on private.worker_events(created_at desc);
create index worker_events_workspace_created_idx
  on private.worker_events(workspace_id, created_at desc)
  where workspace_id is not null;
create index worker_events_worker_created_idx
  on private.worker_events(worker_id, created_at desc)
  where worker_id is not null;
create index worker_events_task_created_idx
  on private.worker_events(task_id, created_at desc)
  where task_id is not null;

revoke all on table private.worker_events from public, anon, authenticated;

create or replace function private.record_worker_event(
  target_event_type text,
  target_workspace_id uuid default null,
  target_worker_id uuid default null,
  target_task_id uuid default null,
  target_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if target_event_type is null
     or char_length(target_event_type) < 1
     or char_length(target_event_type) > 100
     or target_metadata is null
     or jsonb_typeof(target_metadata) <> 'object'
     or pg_column_size(target_metadata) > 2048 then
    raise exception 'WORKER_EVENT_INVALID';
  end if;

  insert into private.worker_events (
    workspace_id, worker_id, task_id, event_type, metadata
  ) values (
    target_workspace_id, target_worker_id, target_task_id,
    target_event_type, target_metadata
  );
end;
$$;

revoke all on function private.record_worker_event(text, uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;

create or replace function public.register_worker_node(
  target_credential_hash text,
  target_software_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_record private.worker_nodes%rowtype;
begin
  if target_credential_hash is null or target_credential_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'WORKER_CREDENTIAL_INVALID';
  end if;
  if target_software_version is null
     or char_length(target_software_version) < 1
     or char_length(target_software_version) > 64 then
    raise exception 'WORKER_VERSION_INVALID';
  end if;

  insert into private.worker_nodes (
    credential_hash, execution_class, software_version
  ) values (
    target_credential_hash, 'foundation_no_egress_v1', target_software_version
  )
  returning * into worker_record;

  perform private.record_worker_event(
    'worker.node_registered', null, worker_record.id, null,
    jsonb_build_object(
      'executionClass', worker_record.execution_class,
      'softwareVersion', worker_record.software_version
    )
  );

  return jsonb_build_object(
    'workerId', worker_record.id,
    'executionClass', worker_record.execution_class,
    'softwareVersion', worker_record.software_version,
    'registeredAt', worker_record.registered_at
  );
exception
  when unique_violation then
    raise exception 'WORKER_CREDENTIAL_CONFLICT';
end;
$$;

create or replace function public.disable_worker_node(
  target_worker_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_record private.worker_nodes%rowtype;
begin
  update private.worker_nodes
  set disabled_at = coalesce(disabled_at, now())
  where id = target_worker_id
  returning * into worker_record;

  if worker_record.id is null then
    raise exception 'WORKER_NOT_AVAILABLE';
  end if;

  perform private.record_worker_event(
    'worker.node_disabled', null, worker_record.id, null, '{}'::jsonb
  );

  return jsonb_build_object(
    'workerId', worker_record.id,
    'disabledAt', worker_record.disabled_at
  );
end;
$$;

create or replace function public.enqueue_foundation_worker_task(
  target_workspace_id uuid,
  target_asset_id uuid,
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
begin
  if not exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = target_actor_id
      and role::text in ('owner', 'admin', 'member')
  ) then
    raise exception 'WORKER_PROBE_ACCESS_DENIED';
  end if;

  if not exists (
    select 1
    from public.assets
    where id = target_asset_id
      and workspace_id = target_workspace_id
  ) then
    raise exception 'WORKER_PROBE_ASSET_MISMATCH';
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
    budget,
    request_count,
    redirect_count,
    finding_count
  ) values (
    target_workspace_id,
    target_asset_id,
    'worker_foundation_probe'::public.scan_job_kind,
    'queued'::public.scan_job_status,
    target_actor_id,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    '{"maxWallTimeMs":30000,"maxCpuTimeMs":20000,"maxMemoryBytes":268435456,"maxProcesses":4,"maxInputFiles":100,"maxInputBytes":10485760,"maxScratchBytes":33554432,"maxOutputBytes":1048576}'::jsonb,
    0,
    0,
    0
  )
  returning * into job_record;

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
    'foundation_no_egress_v1',
    'queued',
    0,
    now(),
    0,
    3,
    now() + interval '5 minutes'
  )
  returning * into task_record;

  perform private.record_worker_event(
    'worker.task_queued', task_record.workspace_id, null, task_record.id,
    jsonb_build_object('scanJobId', task_record.scan_job_id)
  );

  return jsonb_build_object(
    'scanJobId', job_record.id,
    'taskId', task_record.id,
    'executionClass', task_record.execution_class,
    'absoluteDeadlineAt', task_record.absolute_deadline_at
  );
end;
$$;

revoke all on function public.register_worker_node(text, text)
  from public, anon, authenticated;
grant execute on function public.register_worker_node(text, text) to service_role;

revoke all on function public.disable_worker_node(uuid)
  from public, anon, authenticated;
grant execute on function public.disable_worker_node(uuid) to service_role;

revoke all on function public.enqueue_foundation_worker_task(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.enqueue_foundation_worker_task(uuid, uuid, uuid)
  to service_role;
