create or replace function public.register_repository_snapshot_worker_node(
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
    'repository_snapshot_github_public_v1',
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

create or replace function public.enqueue_repository_snapshot_worker_task(
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
  job_record public.scan_jobs%rowtype;
  task_record private.worker_tasks%rowtype;
  identity_match text[];
  request_now timestamptz := now();
  utc_day_start timestamptz := (
    date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
  );
begin
  if target_workspace_id is null
     or target_asset_id is null
     or target_actor_id is null then
    raise exception 'REPOSITORY_SNAPSHOT_REQUEST_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('scopeforge-repository-snapshot-workspace:' || target_workspace_id::text, 0)
  );

  if not exists (
    select 1
      from public.workspace_members
     where workspace_id = target_workspace_id
       and user_id = target_actor_id
       and role::text in ('owner', 'admin')
  ) then
    raise exception 'REPOSITORY_SNAPSHOT_ACCESS_DENIED';
  end if;

  select * into asset_record
    from public.assets
   where id = target_asset_id
     and workspace_id = target_workspace_id
   for update;

  if asset_record.id is null
     or asset_record.kind <> 'repository'::public.asset_kind then
    raise exception 'REPOSITORY_SNAPSHOT_ASSET_MISMATCH';
  end if;

  identity_match := regexp_match(
    asset_record.canonical_target,
    '^https://github[.]com/([^/?#]+)/([^/?#]+)$'
  );
  if identity_match is null
     or array_length(identity_match, 1) <> 2
     or char_length(identity_match[1]) not between 1 and 100
     or char_length(identity_match[2]) not between 1 and 100 then
    raise exception 'REPOSITORY_SNAPSHOT_ASSET_MISMATCH';
  end if;

  if exists (
    select 1
      from public.scan_jobs
     where workspace_id = target_workspace_id
       and asset_id = target_asset_id
       and job_kind = 'repository_snapshot'::public.scan_job_kind
       and created_at > request_now - interval '5 minutes'
  ) then
    raise exception 'REPOSITORY_SNAPSHOT_COOLDOWN';
  end if;

  if exists (
    select 1
      from public.scan_jobs
     where workspace_id = target_workspace_id
       and job_kind = 'repository_snapshot'::public.scan_job_kind
       and status in ('queued'::public.scan_job_status, 'running'::public.scan_job_status)
  ) then
    raise exception 'REPOSITORY_SNAPSHOT_ACTIVE_LIMIT';
  end if;

  if (
    select count(*)
      from public.scan_jobs
     where workspace_id = target_workspace_id
       and job_kind = 'repository_snapshot'::public.scan_job_kind
       and created_at >= utc_day_start
  ) >= 20 then
    raise exception 'REPOSITORY_SNAPSHOT_DAILY_LIMIT';
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
    'repository_snapshot'::public.scan_job_kind,
    'queued'::public.scan_job_status,
    target_actor_id,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    '{"maxWallTimeMs":300000,"maxCpuTimeMs":120000,"maxMemoryBytes":536870912,"maxProcesses":1,"maxInputFiles":20000,"maxInputBytes":268435456,"maxScratchBytes":536870912,"maxOutputBytes":65536}'::jsonb,
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
    'repository_snapshot_github_public_v1',
    'queued',
    0,
    request_now,
    0,
    3,
    request_now + interval '20 minutes'
  )
  returning * into task_record;

  insert into private.repository_snapshot_tasks (
    task_id,
    scan_job_id,
    workspace_id,
    asset_id,
    requested_by,
    schema_version,
    owner_name,
    repository_name,
    canonical_repository_url,
    created_at
  ) values (
    task_record.id,
    job_record.id,
    target_workspace_id,
    target_asset_id,
    target_actor_id,
    1,
    identity_match[1],
    identity_match[2],
    asset_record.canonical_target,
    request_now
  );

  perform private.record_worker_event(
    'worker.task_queued', task_record.workspace_id, null, task_record.id,
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

create or replace function public.claim_worker_task(
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
  job_record public.scan_jobs%rowtype;
  attempt_record private.worker_attempts%rowtype;
  repository_task private.repository_snapshot_tasks%rowtype;
  claim_now timestamptz := now();
  lease_token bytea;
  lease_token_text text;
  lease_expiry timestamptz;
  artifact_object_key text;
begin
  perform pg_advisory_xact_lock(hashtextextended('scopeforge-worker-claim-v1', 0));

  select * into worker_record
    from private.worker_nodes
   where id = target_worker_id
   for update;

  if worker_record.id is null or worker_record.disabled_at is not null then
    raise exception 'WORKER_DISABLED';
  end if;

  if (
    select count(*)
      from private.worker_tasks
     where state = 'leased'
  ) >= 4 then
    return null;
  end if;

  select t.* into task_record
    from private.worker_tasks t
    join public.scan_jobs j
      on j.id = t.scan_job_id
     and j.workspace_id = t.workspace_id
     and j.asset_id = t.asset_id
   where t.execution_class = worker_record.execution_class
     and t.state in ('queued', 'retry_wait')
     and t.available_at <= claim_now
     and t.absolute_deadline_at > claim_now
     and (
       (worker_record.execution_class = 'foundation_no_egress_v1'
        and j.job_kind = 'worker_foundation_probe'::public.scan_job_kind)
       or
       (worker_record.execution_class = 'repository_snapshot_github_public_v1'
        and j.job_kind = 'repository_snapshot'::public.scan_job_kind)
     )
     and j.status in ('queued'::public.scan_job_status, 'running'::public.scan_job_status)
     and j.cancel_requested_at is null
     and not exists (
       select 1
         from private.worker_tasks active_task
        where active_task.workspace_id = t.workspace_id
          and active_task.state = 'leased'
     )
   order by priority desc, available_at asc, created_at asc, id asc
   for update of t skip locked
   limit 1;

  if task_record.id is null then
    return null;
  end if;

  select * into job_record
    from public.scan_jobs
   where id = task_record.scan_job_id
     and workspace_id = task_record.workspace_id
     and asset_id = task_record.asset_id
   for update;

  if job_record.cancel_requested_at is not null
     or job_record.status in (
       'succeeded'::public.scan_job_status,
       'failed'::public.scan_job_status,
       'blocked'::public.scan_job_status,
       'cancelled'::public.scan_job_status
     ) then
    return null;
  end if;

  if task_record.execution_class = 'repository_snapshot_github_public_v1' then
    select * into repository_task
      from private.repository_snapshot_tasks
     where task_id = task_record.id
       and scan_job_id = task_record.scan_job_id
       and workspace_id = task_record.workspace_id
       and asset_id = task_record.asset_id;
    if repository_task.task_id is null then
      raise exception 'REPOSITORY_SNAPSHOT_TASK_INVALID';
    end if;
  end if;

  lease_token := extensions.gen_random_bytes(32);
  lease_token_text := encode(lease_token, 'hex');
  lease_expiry := least(claim_now + interval '90 seconds', task_record.absolute_deadline_at);

  update private.worker_tasks
     set state = 'leased',
         attempt_count = task_record.attempt_count + 1,
         updated_at = claim_now
   where id = task_record.id
  returning * into task_record;

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

  if task_record.execution_class = 'repository_snapshot_github_public_v1' then
    artifact_object_key := 'repository-source/'
      || encode(extensions.gen_random_bytes(32), 'hex')
      || '.tar.gz';

    insert into private.repository_snapshot_attempt_uploads (
      attempt_id, task_id, object_key, created_at
    ) values (
      attempt_record.id, task_record.id, artifact_object_key, claim_now
    );
  end if;

  if job_record.status = 'queued'::public.scan_job_status then
    update public.scan_jobs
       set status = 'running'::public.scan_job_status,
           started_at = coalesce(started_at, claim_now)
     where id = job_record.id
       and status = 'queued'::public.scan_job_status
    returning * into job_record;
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
      'leaseExpiresAt', attempt_record.lease_expires_at
    )
  );

  if task_record.execution_class = 'foundation_no_egress_v1' then
    return jsonb_build_object(
      'taskId', task_record.id,
      'attemptId', attempt_record.id,
      'executionClass', task_record.execution_class,
      'leaseToken', lease_token_text,
      'leaseExpiresAt', attempt_record.lease_expires_at,
      'absoluteDeadlineAt', task_record.absolute_deadline_at,
      'budget', job_record.budget,
      'input', jsonb_build_object(
        'kind', 'foundation_probe',
        'nonce', task_record.id::text
      )
    );
  end if;

  return jsonb_build_object(
    'taskId', task_record.id,
    'attemptId', attempt_record.id,
    'executionClass', task_record.execution_class,
    'leaseToken', lease_token_text,
    'leaseExpiresAt', attempt_record.lease_expires_at,
    'absoluteDeadlineAt', task_record.absolute_deadline_at,
    'budget', job_record.budget,
    'artifactObjectKey', artifact_object_key,
    'input', jsonb_build_object(
      'kind', 'repository_snapshot_github_public',
      'owner', repository_task.owner_name,
      'repository', repository_task.repository_name,
      'canonicalRepositoryUrl', repository_task.canonical_repository_url
    )
  );
end;
$$;

create or replace function public.get_repository_snapshot_attempt_artifact(
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
  attempt_record private.worker_attempts%rowtype;
  upload_record private.repository_snapshot_attempt_uploads%rowtype;
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
  select * into attempt_record
    from private.worker_attempts
   where id = target_attempt_id
     and task_id = target_task_id;

  if worker_record.id is null
     or worker_record.disabled_at is not null
     or worker_record.execution_class <> 'repository_snapshot_github_public_v1'
     or task_record.id is null
     or task_record.execution_class <> 'repository_snapshot_github_public_v1'
     or task_record.state <> 'leased'
     or attempt_record.id is null
     or attempt_record.worker_id <> target_worker_id
     or attempt_record.lease_token_hash <> calculated_hash
     or attempt_record.finished_at is not null
     or attempt_record.lease_expires_at <= lookup_now then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  select * into upload_record
    from private.repository_snapshot_attempt_uploads
   where attempt_id = target_attempt_id
     and task_id = target_task_id;

  if upload_record.attempt_id is null then
    raise exception 'REPOSITORY_SNAPSHOT_ARTIFACT_NOT_AVAILABLE';
  end if;

  return jsonb_build_object(
    'objectKey', upload_record.object_key,
    'createdAt', upload_record.created_at
  );
end;
$$;

revoke all on function public.register_repository_snapshot_worker_node(text, text)
  from public, anon, authenticated;
grant execute on function public.register_repository_snapshot_worker_node(text, text)
  to service_role;

revoke all on function public.enqueue_repository_snapshot_worker_task(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.enqueue_repository_snapshot_worker_task(uuid, uuid, uuid)
  to service_role;

revoke all on function public.claim_worker_task(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_worker_task(uuid) to service_role;

revoke all on function public.get_repository_snapshot_attempt_artifact(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.get_repository_snapshot_attempt_artifact(uuid, uuid, uuid, text)
  to service_role;
