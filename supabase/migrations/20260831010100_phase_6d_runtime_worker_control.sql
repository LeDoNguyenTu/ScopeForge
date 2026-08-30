create or replace function public.register_passive_runtime_worker_node(
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
    'passive_runtime_observation_v1',
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

create or replace function public.register_active_cors_worker_node(
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
    'active_cors_validation_v1',
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
     or job_record.requested_by <> target_actor_id then
    raise exception 'RUNTIME_WORKER_TASK_INVALID';
  end if;

  if exists (
    select 1
      from private.worker_tasks
     where workspace_id = target_workspace_id
       and execution_class in (
         'passive_runtime_observation_v1',
         'active_cors_validation_v1'
       )
       and state in ('queued', 'leased', 'retry_wait')
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
     or job_record.requested_by <> target_actor_id then
    raise exception 'RUNTIME_WORKER_TASK_INVALID';
  end if;

  if exists (
    select 1
      from private.worker_tasks
     where workspace_id = target_workspace_id
       and execution_class in (
         'passive_runtime_observation_v1',
         'active_cors_validation_v1'
       )
       and state in ('queued', 'leased', 'retry_wait')
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
  claim_now timestamptz := now();
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
     where execution_class = worker_record.execution_class
       and state = 'leased'
  ) >= 4 then
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
     and t.available_at <= claim_now
     and t.absolute_deadline_at > claim_now
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

  if runtime_task.task_id is null
     or job_record.id is null
     or job_record.status <> 'queued'::public.scan_job_status
     or job_record.cancel_requested_at is not null
     or job_record.requested_by <> runtime_task.requested_by then
    raise exception 'WORKER_JOB_STATE_CONFLICT';
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
  returning * into task_record;

  if task_record.id is null then
    raise exception 'WORKER_JOB_STATE_CONFLICT';
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

create or replace function public.get_runtime_worker_preparation_context(
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
  worker_record private.worker_nodes%rowtype;
  task_record private.worker_tasks%rowtype;
  runtime_task private.runtime_worker_tasks%rowtype;
  attempt_record private.worker_attempts%rowtype;
  job_record public.scan_jobs%rowtype;
  calculated_hash text;
  lookup_now timestamptz := now();
begin
  if target_lease_token is null or target_lease_token !~ '^[a-f0-9]{64}$' then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  calculated_hash := encode(
    extensions.digest(decode(target_lease_token, 'hex'), 'sha256'),
    'hex'
  );

  select * into worker_record
    from private.worker_nodes
   where id = target_worker_id;

  select * into task_record
    from private.worker_tasks
   where id = target_task_id;

  select * into runtime_task
    from private.runtime_worker_tasks
   where task_id = target_task_id;

  select * into attempt_record
    from private.worker_attempts
   where id = target_attempt_id
     and task_id = target_task_id;

  if worker_record.id is null
     or worker_record.disabled_at is not null
     or worker_record.execution_class not in (
       'passive_runtime_observation_v1',
       'active_cors_validation_v1'
     )
     or task_record.id is null
     or task_record.execution_class <> worker_record.execution_class
     or task_record.state <> 'leased'
     or task_record.absolute_deadline_at <= lookup_now
     or runtime_task.task_id is null
     or runtime_task.scan_job_id <> task_record.scan_job_id
     or runtime_task.workspace_id <> task_record.workspace_id
     or runtime_task.asset_id <> task_record.asset_id
     or attempt_record.id is null
     or attempt_record.worker_id <> target_worker_id
     or attempt_record.lease_token_hash <> calculated_hash
     or attempt_record.finished_at is not null
     or attempt_record.lease_expires_at <= lookup_now then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  select * into job_record
    from public.scan_jobs
   where id = runtime_task.scan_job_id
     and workspace_id = runtime_task.workspace_id
     and asset_id = runtime_task.asset_id;

  if job_record.id is null
     or job_record.status <> 'queued'::public.scan_job_status
     or job_record.cancel_requested_at is not null
     or job_record.requested_by <> runtime_task.requested_by
     or job_record.job_kind <> runtime_task.domain_job_kind then
    raise exception 'RUNTIME_WORKER_TASK_INVALID';
  end if;

  if not (
    (task_record.execution_class = 'passive_runtime_observation_v1'
      and runtime_task.domain_job_kind = 'passive_runtime'::public.scan_job_kind)
    or
    (task_record.execution_class = 'active_cors_validation_v1'
      and runtime_task.domain_job_kind = 'active_validation'::public.scan_job_kind)
  ) then
    raise exception 'RUNTIME_WORKER_CLASS_MISMATCH';
  end if;

  return jsonb_build_object(
    'taskId', task_record.id,
    'attemptId', attempt_record.id,
    'executionClass', task_record.execution_class,
    'domainJobId', runtime_task.scan_job_id,
    'workspaceId', runtime_task.workspace_id,
    'assetId', runtime_task.asset_id,
    'requestedBy', runtime_task.requested_by,
    'domainJobKind', runtime_task.domain_job_kind::text,
    'leaseExpiresAt', attempt_record.lease_expires_at,
    'absoluteDeadlineAt', task_record.absolute_deadline_at
  );
end;
$$;

revoke all on function public.register_passive_runtime_worker_node(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.register_passive_runtime_worker_node(text, text)
  to service_role;

revoke all on function public.register_active_cors_worker_node(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.register_active_cors_worker_node(text, text)
  to service_role;

revoke all on function public.enqueue_passive_runtime_worker_task(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.enqueue_passive_runtime_worker_task(uuid, uuid, uuid)
  to service_role;

revoke all on function public.enqueue_active_cors_worker_task(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.enqueue_active_cors_worker_task(uuid, uuid, uuid)
  to service_role;

revoke all on function public.claim_runtime_worker_task(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_runtime_worker_task(uuid)
  to service_role;

revoke all on function public.get_runtime_worker_preparation_context(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_runtime_worker_preparation_context(uuid, uuid, uuid, text)
  to service_role;
