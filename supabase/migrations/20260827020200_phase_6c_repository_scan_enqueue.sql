create or replace function public.register_repository_scan_worker_node(
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
    target_credential_hash,
    'phase3_repository_scan_no_egress_v1',
    target_software_version
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

create or replace function public.enqueue_repository_scan_worker_task(
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
     or target_actor_id is null then
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
   where s.workspace_id = target_workspace_id
     and s.asset_id = target_asset_id
     and s.canonical_repository_url = asset_record.canonical_target
     and s.expires_at >= request_now + interval '30 minutes'
     and a.deletion_status = 'active'
     and a.deleted_at is null
     and a.expires_at >= request_now + interval '30 minutes'
     and a.stored_byte_count = s.stored_artifact_bytes
     and a.artifact_digest = s.artifact_digest
   order by s.created_at desc, s.id desc
   for update of s, a
   limit 1;

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

revoke all on function public.register_repository_scan_worker_node(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.register_repository_scan_worker_node(text, text)
  to service_role;

revoke all on function public.enqueue_repository_scan_worker_task(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.enqueue_repository_scan_worker_task(uuid, uuid, uuid)
  to service_role;