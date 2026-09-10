create or replace function public.enqueue_repository_scan_worker_task_for_snapshot(
  target_workspace_id uuid,
  target_asset_id uuid,
  target_actor_id uuid,
  target_snapshot_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  asset_record public.assets%rowtype;
  snapshot_record public.repository_source_snapshots%rowtype;
  job_record public.scan_jobs%rowtype;
  task_record private.worker_tasks%rowtype;
  request_now timestamptz := now();
  utc_day_start timestamptz := (
    date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
  );
begin
  if target_workspace_id is null
     or target_asset_id is null
     or target_actor_id is null
     or target_snapshot_id is null then
    raise exception 'REPOSITORY_SCAN_REQUEST_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('scopeforge-repository-scan-workspace:' || target_workspace_id::text, 0)
  );

  if not exists (
    select 1
      from public.workspace_members
     where workspace_id = target_workspace_id
       and user_id = target_actor_id
       and role::text in ('owner', 'admin')
  ) then
    raise exception 'REPOSITORY_SCAN_ACCESS_DENIED';
  end if;

  select * into asset_record
    from public.assets
   where id = target_asset_id
     and workspace_id = target_workspace_id
   for update;

  if asset_record.id is null
     or asset_record.kind <> 'repository'::public.asset_kind then
    raise exception 'REPOSITORY_SCAN_ASSET_MISMATCH';
  end if;

  select s.* into snapshot_record
    from public.repository_source_snapshots s
    join private.repository_source_artifacts a
      on a.snapshot_id = s.id
   where s.id = target_snapshot_id
     and s.workspace_id = target_workspace_id
     and s.asset_id = target_asset_id
     and s.canonical_repository_url = asset_record.canonical_target
     and s.expires_at >= request_now + interval '30 minutes'
     and a.deletion_status = 'active'
     and a.deleted_at is null
     and a.expires_at >= request_now + interval '30 minutes'
     and a.stored_byte_count = s.stored_artifact_bytes
     and a.artifact_digest = s.artifact_digest
   for update of s, a;

  if snapshot_record.id is null then
    raise exception 'REPOSITORY_SCAN_SNAPSHOT_NOT_AVAILABLE';
  end if;

  if exists (
    select 1
      from public.scan_jobs
     where workspace_id = target_workspace_id
       and asset_id = target_asset_id
       and job_kind = 'repository_scan'::public.scan_job_kind
       and created_at > request_now - interval '5 minutes'
  ) then
    raise exception 'REPOSITORY_SCAN_COOLDOWN';
  end if;

  if exists (
    select 1
      from public.scan_jobs
     where workspace_id = target_workspace_id
       and job_kind = 'repository_scan'::public.scan_job_kind
       and status in ('queued'::public.scan_job_status, 'running'::public.scan_job_status)
  ) then
    raise exception 'REPOSITORY_SCAN_ACTIVE_LIMIT';
  end if;

  if (
    select count(*)
      from public.scan_jobs
     where workspace_id = target_workspace_id
       and job_kind = 'repository_scan'::public.scan_job_kind
       and created_at >= utc_day_start
  ) >= 20 then
    raise exception 'REPOSITORY_SCAN_DAILY_LIMIT';
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
    'repository_scan'::public.scan_job_kind,
    'queued'::public.scan_job_status,
    target_actor_id,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    '{"maxWallTimeMs":300000,"maxCpuTimeMs":300000,"maxMemoryBytes":1073741824,"maxProcesses":64,"maxInputFiles":20000,"maxInputBytes":268435456,"maxScratchBytes":268435456,"maxOutputBytes":3670016}'::jsonb,
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
    'phase3_repository_scan_no_egress_v1',
    'queued',
    0,
    request_now,
    0,
    3,
    request_now + interval '20 minutes'
  )
  returning * into task_record;

  insert into private.repository_scan_tasks (
    task_id,
    scan_job_id,
    workspace_id,
    asset_id,
    snapshot_id,
    requested_by,
    schema_version,
    scanner_profile_id,
    scanner_profile_version,
    created_at
  ) values (
    task_record.id,
    job_record.id,
    target_workspace_id,
    target_asset_id,
    snapshot_record.id,
    target_actor_id,
    1,
    'phase3-hosted-static-v1',
    1,
    request_now
  );

  perform private.record_worker_event(
    'worker.task_queued', task_record.workspace_id, null, task_record.id,
    jsonb_build_object(
      'scanJobId', task_record.scan_job_id,
      'executionClass', task_record.execution_class,
      'snapshotId', snapshot_record.id
    )
  );

  return jsonb_build_object(
    'scanJobId', job_record.id,
    'taskId', task_record.id,
    'snapshotId', snapshot_record.id,
    'executionClass', task_record.execution_class,
    'absoluteDeadlineAt', task_record.absolute_deadline_at
  );
end;
$$;

revoke all on function public.enqueue_repository_scan_worker_task_for_snapshot(uuid, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.enqueue_repository_scan_worker_task_for_snapshot(uuid, uuid, uuid, uuid)
  to service_role;

create or replace function public.get_connected_project_scan_recovery(
  target_workspace_id uuid,
  target_asset_id uuid,
  target_actor_id uuid,
  target_link_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  intent_record private.github_project_scan_intents%rowtype;
begin
  if target_workspace_id is null
     or target_asset_id is null
     or target_actor_id is null
     or target_link_id is null then
    raise exception 'PROJECT_SCAN_RECOVERY_INVALID';
  end if;

  if not exists (
    select 1
      from public.workspace_members
     where workspace_id = target_workspace_id
       and user_id = target_actor_id
       and role::text in ('owner', 'admin')
  ) then
    raise exception 'PROJECT_SCAN_ACCESS_DENIED';
  end if;

  select i.* into intent_record
    from private.github_project_scan_intents i
    join public.github_repository_links l
      on l.id = i.link_id
     and l.workspace_id = i.workspace_id
     and l.asset_id = i.asset_id
    join public.github_connections c
      on c.id = l.github_connection_id
     and c.workspace_id = l.workspace_id
   where i.workspace_id = target_workspace_id
     and i.asset_id = target_asset_id
     and i.link_id = target_link_id
     and i.state in (
       'waiting_scan_runtime',
       'retry_pending',
       'scan_queued'
     )
     and i.snapshot_task_id is not null
     and i.snapshot_id is not null
     and l.access_status = 'active'
     and not l.is_private
     and c.status = 'active'
   limit 1;

  if intent_record.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'snapshotTaskId', intent_record.snapshot_task_id,
    'snapshotId', intent_record.snapshot_id,
    'state', intent_record.state
  );
end;
$$;

revoke all on function public.get_connected_project_scan_recovery(uuid, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_connected_project_scan_recovery(uuid, uuid, uuid, uuid)
  to service_role;

create or replace function public.enqueue_connected_project_scan_continuation(
  target_snapshot_task_id uuid,
  target_snapshot_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  intent_record private.github_project_scan_intents%rowtype;
  continuation jsonb;
  scan_enqueue_result jsonb;
  queued_scan_task_id uuid;
  queued_scan_job_id uuid;
begin
  if target_snapshot_task_id is null or target_snapshot_id is null then
    raise exception 'PROJECT_SCAN_CONTINUATION_INVALID';
  end if;

  select * into intent_record
    from private.github_project_scan_intents
   where snapshot_task_id = target_snapshot_task_id
   for update;

  if intent_record.id is null then
    return null;
  end if;

  continuation := public.get_connected_project_snapshot_continuation(
    target_snapshot_task_id,
    target_snapshot_id
  );

  if intent_record.state = 'scan_queued' then
    if intent_record.snapshot_id <> target_snapshot_id
       or intent_record.scan_task_id is null
       or intent_record.scan_job_id is null then
      raise exception 'PROJECT_SCAN_SNAPSHOT_MISMATCH';
    end if;
    return jsonb_build_object(
      'taskId', intent_record.scan_task_id,
      'scanJobId', intent_record.scan_job_id,
      'snapshotId', intent_record.snapshot_id,
      'replayed', true
    );
  end if;

  if intent_record.state not in (
    'snapshot_queued',
    'waiting_scan_runtime',
    'retry_pending'
  ) then
    raise exception 'PROJECT_SCAN_STATE_INVALID';
  end if;

  if (continuation->>'isPrivate')::boolean
     or continuation->>'accessStatus' <> 'active' then
    raise exception 'PROJECT_SCAN_LINK_INELIGIBLE';
  end if;

  scan_enqueue_result := public.enqueue_repository_scan_worker_task_for_snapshot(
    intent_record.workspace_id,
    intent_record.asset_id,
    intent_record.requested_by,
    target_snapshot_id
  );

  if scan_enqueue_result->>'snapshotId' is distinct from target_snapshot_id::text then
    raise exception 'PROJECT_SCAN_SNAPSHOT_MISMATCH';
  end if;

  queued_scan_task_id := nullif(scan_enqueue_result->>'taskId', '')::uuid;
  queued_scan_job_id := nullif(scan_enqueue_result->>'scanJobId', '')::uuid;
  if queued_scan_task_id is null or queued_scan_job_id is null then
    raise exception 'PROJECT_SCAN_SCAN_ENQUEUE_INVALID';
  end if;

  update private.github_project_scan_intents
     set snapshot_id = target_snapshot_id,
         scan_task_id = queued_scan_task_id,
         scan_job_id = queued_scan_job_id,
         state = 'scan_queued',
         last_error_code = null
   where id = intent_record.id;

  update public.github_repository_links
     set project_scan_state = 'scan_queued'
   where id = intent_record.link_id
     and workspace_id = intent_record.workspace_id;

  return jsonb_build_object(
    'taskId', queued_scan_task_id,
    'scanJobId', queued_scan_job_id,
    'snapshotId', target_snapshot_id,
    'replayed', false
  );
end;
$$;

revoke all on function public.enqueue_connected_project_scan_continuation(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.enqueue_connected_project_scan_continuation(uuid, uuid)
  to service_role;
