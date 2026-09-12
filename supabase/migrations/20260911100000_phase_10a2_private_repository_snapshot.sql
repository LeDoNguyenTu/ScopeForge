-- Phase 10A2: private GitHub repository snapshot persistence and claim routing.
-- Credentials and archive capabilities are intentionally never persisted.

alter table private.worker_nodes
  drop constraint if exists worker_nodes_execution_class_check;
alter table private.worker_nodes
  add constraint worker_nodes_execution_class_check check (
    execution_class in (
      'foundation_no_egress_v1',
      'repository_snapshot_github_public_v1',
      'repository_snapshot_github_private_v1',
      'phase3_repository_scan_no_egress_v1',
      'passive_runtime_observation_v1',
      'active_cors_validation_v1'
    )
  );

alter table private.worker_tasks
  drop constraint if exists worker_tasks_execution_class_check;
alter table private.worker_tasks
  add constraint worker_tasks_execution_class_check check (
    execution_class in (
      'foundation_no_egress_v1',
      'repository_snapshot_github_public_v1',
      'repository_snapshot_github_private_v1',
      'phase3_repository_scan_no_egress_v1',
      'passive_runtime_observation_v1',
      'active_cors_validation_v1'
    )
  );

alter table public.repository_source_snapshots
  drop constraint if exists repository_source_snapshots_source_kind_check;
alter table public.repository_source_snapshots
  add constraint repository_source_snapshots_source_kind_check check (
    source_kind in ('github_public_archive', 'github_private_archive')
  );

alter table private.repository_snapshot_tasks
  add column github_repository_link_id uuid;

alter table private.repository_snapshot_tasks
  add constraint repository_snapshot_tasks_github_link_workspace_fkey
  foreign key (github_repository_link_id, workspace_id)
  references public.github_repository_links(id, workspace_id)
  on delete restrict;

create index repository_snapshot_tasks_github_link_idx
  on private.repository_snapshot_tasks(github_repository_link_id)
  where github_repository_link_id is not null;

create or replace function public.register_private_repository_snapshot_worker_node(
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

  insert into private.worker_nodes (credential_hash, execution_class, software_version)
  values (
    target_credential_hash,
    'repository_snapshot_github_private_v1',
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
revoke all on function public.register_private_repository_snapshot_worker_node(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.register_private_repository_snapshot_worker_node(text, text)
  to service_role;

create or replace function public.enqueue_private_repository_snapshot_worker_task(
  target_workspace_id uuid,
  target_asset_id uuid,
  target_actor_id uuid,
  target_github_repository_link_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  asset_record public.assets%rowtype;
  link_record public.github_repository_links%rowtype;
  connection_record public.github_connections%rowtype;
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
     or target_github_repository_link_id is null then
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

  select * into link_record
    from public.github_repository_links
   where id = target_github_repository_link_id
     and workspace_id = target_workspace_id
     and asset_id = target_asset_id
   for update;

  if link_record.id is null
     or not link_record.is_private
     or link_record.access_status <> 'active' then
    raise exception 'GITHUB_REPOSITORY_LINK_UNAVAILABLE';
  end if;

  select * into connection_record
    from public.github_connections
   where id = link_record.github_connection_id
     and workspace_id = target_workspace_id
   for update;
  if connection_record.id is null or connection_record.status <> 'active' then
    raise exception 'GITHUB_REPOSITORY_LINK_UNAVAILABLE';
  end if;

  select * into asset_record
    from public.assets
   where id = target_asset_id
     and workspace_id = target_workspace_id
   for update;
  if asset_record.id is null
     or asset_record.kind <> 'repository'::public.asset_kind
     or asset_record.canonical_target <> link_record.html_url then
    raise exception 'REPOSITORY_SNAPSHOT_ASSET_MISMATCH';
  end if;

  if exists (
    select 1 from public.scan_jobs
     where workspace_id = target_workspace_id
       and asset_id = target_asset_id
       and job_kind = 'repository_snapshot'::public.scan_job_kind
       and created_at > request_now - interval '5 minutes'
  ) then
    raise exception 'REPOSITORY_SNAPSHOT_COOLDOWN';
  end if;

  if exists (
    select 1 from public.scan_jobs
     where workspace_id = target_workspace_id
       and job_kind = 'repository_snapshot'::public.scan_job_kind
       and status in ('queued'::public.scan_job_status, 'running'::public.scan_job_status)
  ) then
    raise exception 'REPOSITORY_SNAPSHOT_ACTIVE_LIMIT';
  end if;

  if (
    select count(*) from public.scan_jobs
     where workspace_id = target_workspace_id
       and job_kind = 'repository_snapshot'::public.scan_job_kind
       and created_at >= utc_day_start
  ) >= 20 then
    raise exception 'REPOSITORY_SNAPSHOT_DAILY_LIMIT';
  end if;

  insert into public.scan_jobs (
    workspace_id, asset_id, job_kind, status, requested_by,
    blocked_reason, authorization_canonical_target, authorization_asset_kind,
    authorization_verified_at, validation_profile_id, validation_profile_version,
    authorization_granted_at, budget, request_count, redirect_count, finding_count
  ) values (
    target_workspace_id, target_asset_id,
    'repository_snapshot'::public.scan_job_kind,
    'queued'::public.scan_job_status,
    target_actor_id,
    null, null, null, null, null, null, null,
    '{"maxWallTimeMs":300000,"maxCpuTimeMs":120000,"maxMemoryBytes":536870912,"maxProcesses":1,"maxInputFiles":20000,"maxInputBytes":268435456,"maxScratchBytes":536870912,"maxOutputBytes":65536}'::jsonb,
    0, 0, 0
  ) returning * into job_record;

  insert into private.worker_tasks (
    scan_job_id, workspace_id, asset_id, execution_class, state,
    priority, available_at, attempt_count, max_attempts, absolute_deadline_at
  ) values (
    job_record.id, job_record.workspace_id, job_record.asset_id,
    'repository_snapshot_github_private_v1', 'queued',
    0, request_now, 0, 3, request_now + interval '20 minutes'
  ) returning * into task_record;

  insert into private.repository_snapshot_tasks (
    task_id, scan_job_id, workspace_id, asset_id, requested_by,
    schema_version, owner_name, repository_name, canonical_repository_url,
    github_repository_link_id, created_at
  ) values (
    task_record.id, job_record.id, target_workspace_id, target_asset_id, target_actor_id,
    1, link_record.owner_login, link_record.repository_name, link_record.html_url,
    link_record.id, request_now
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
revoke all on function public.enqueue_private_repository_snapshot_worker_task(uuid, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.enqueue_private_repository_snapshot_worker_task(uuid, uuid, uuid, uuid)
  to service_role;

-- Preserve the proven public/foundation claim path and route only private workers here.
alter function public.claim_worker_task(uuid) rename to claim_worker_task_v10a2_base;
alter function public.claim_worker_task_v10a2_base(uuid) set schema private;
revoke all on function private.claim_worker_task_v10a2_base(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.claim_private_repository_snapshot_worker_task(
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
  link_record public.github_repository_links%rowtype;
  connection_record public.github_connections%rowtype;
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
  if worker_record.execution_class <> 'repository_snapshot_github_private_v1' then
    raise exception 'WORKER_CLASS_UNAVAILABLE';
  end if;

  if (select count(*) from private.worker_tasks where state = 'leased') >= 4 then
    return null;
  end if;

  select t.* into task_record
    from private.worker_tasks t
    join public.scan_jobs j
      on j.id = t.scan_job_id
     and j.workspace_id = t.workspace_id
     and j.asset_id = t.asset_id
    join private.repository_snapshot_tasks rst
      on rst.task_id = t.id
     and rst.scan_job_id = t.scan_job_id
     and rst.workspace_id = t.workspace_id
     and rst.asset_id = t.asset_id
    join public.github_repository_links grl
      on grl.id = rst.github_repository_link_id
     and grl.workspace_id = t.workspace_id
     and grl.asset_id = t.asset_id
    join public.github_connections gc
      on gc.id = grl.github_connection_id
     and gc.workspace_id = t.workspace_id
   where t.execution_class = 'repository_snapshot_github_private_v1'
     and t.state in ('queued', 'retry_wait')
     and t.available_at <= claim_now
     and t.absolute_deadline_at > claim_now
     and j.job_kind = 'repository_snapshot'::public.scan_job_kind
     and j.status in ('queued'::public.scan_job_status, 'running'::public.scan_job_status)
     and j.cancel_requested_at is null
     and grl.is_private
     and grl.access_status = 'active'
     and gc.status = 'active'
     and not exists (
       select 1 from private.worker_tasks active_task
        where active_task.workspace_id = t.workspace_id
          and active_task.state = 'leased'
     )
   order by t.priority desc, t.available_at asc, t.created_at asc, t.id asc
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
  select * into repository_task
    from private.repository_snapshot_tasks
   where task_id = task_record.id
     and scan_job_id = task_record.scan_job_id
     and workspace_id = task_record.workspace_id
     and asset_id = task_record.asset_id;
  select * into link_record
    from public.github_repository_links
   where id = repository_task.github_repository_link_id
     and workspace_id = task_record.workspace_id
     and asset_id = task_record.asset_id
   for update;
  select * into connection_record
    from public.github_connections
   where id = link_record.github_connection_id
     and workspace_id = task_record.workspace_id
   for update;

  if job_record.id is null
     or repository_task.task_id is null
     or repository_task.github_repository_link_id is null
     or link_record.id is null
     or not link_record.is_private
     or link_record.access_status <> 'active'
     or connection_record.id is null
     or connection_record.status <> 'active'
     or link_record.html_url <> repository_task.canonical_repository_url
     or link_record.owner_login <> repository_task.owner_name
     or link_record.repository_name <> repository_task.repository_name then
    raise exception 'GITHUB_REPOSITORY_LINK_UNAVAILABLE';
  end if;

  lease_token := extensions.gen_random_bytes(32);
  lease_token_text := encode(lease_token, 'hex');
  lease_expiry := least(claim_now + interval '90 seconds', task_record.absolute_deadline_at);

  update private.worker_tasks
     set state = 'leased',
         attempt_count = task_record.attempt_count + 1,
         updated_at = claim_now
   where id = task_record.id
     and state in ('queued', 'retry_wait')
   returning * into task_record;
  if task_record.id is null then
    return null;
  end if;

  insert into private.worker_attempts (
    task_id, attempt_number, worker_id, lease_token_hash,
    leased_at, lease_expires_at, last_heartbeat_at
  ) values (
    task_record.id, task_record.attempt_count, worker_record.id,
    encode(extensions.digest(lease_token, 'sha256'), 'hex'),
    claim_now, lease_expiry, claim_now
  ) returning * into attempt_record;

  artifact_object_key := 'repository-source/'
    || encode(extensions.gen_random_bytes(32), 'hex') || '.tar.gz';
  insert into private.repository_snapshot_attempt_uploads (
    attempt_id, task_id, object_key, created_at
  ) values (
    attempt_record.id, task_record.id, artifact_object_key, claim_now
  );

  if job_record.status = 'queued'::public.scan_job_status then
    update public.scan_jobs
       set status = 'running'::public.scan_job_status,
           started_at = coalesce(started_at, claim_now)
     where id = job_record.id
       and status = 'queued'::public.scan_job_status;
  end if;

  update private.worker_nodes set last_seen_at = claim_now where id = worker_record.id;

  perform private.record_worker_event(
    'worker.task_claimed', task_record.workspace_id, worker_record.id, task_record.id,
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
    'budget', job_record.budget,
    'artifactObjectKey', artifact_object_key,
    'input', jsonb_build_object(
      'kind', 'repository_snapshot_github_private',
      'owner', repository_task.owner_name,
      'repository', repository_task.repository_name,
      'canonicalRepositoryUrl', repository_task.canonical_repository_url,
      'githubRepositoryLinkId', repository_task.github_repository_link_id
    )
  );
end;
$$;
revoke all on function private.claim_private_repository_snapshot_worker_task(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.claim_worker_task(target_worker_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_class text;
begin
  select execution_class into worker_class
    from private.worker_nodes
   where id = target_worker_id;

  if worker_class = 'repository_snapshot_github_private_v1' then
    return private.claim_private_repository_snapshot_worker_task(target_worker_id);
  end if;
  return private.claim_worker_task_v10a2_base(target_worker_id);
end;
$$;
revoke all on function public.claim_worker_task(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_worker_task(uuid) to service_role;

-- Preserve the old artifact lookup for existing classes and add a private class-aware path.
alter function public.get_repository_snapshot_attempt_artifact(uuid, uuid, uuid, text)
  rename to get_repository_snapshot_attempt_artifact_v10a2_base;
alter function public.get_repository_snapshot_attempt_artifact_v10a2_base(uuid, uuid, uuid, text)
  set schema private;
revoke all on function private.get_repository_snapshot_attempt_artifact_v10a2_base(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.get_private_repository_snapshot_attempt_artifact(
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
    extensions.digest(decode(target_lease_token, 'hex'), 'sha256'), 'hex'
  );

  select * into worker_record from private.worker_nodes where id = target_worker_id;
  select * into task_record from private.worker_tasks where id = target_task_id;
  select * into attempt_record
    from private.worker_attempts
   where id = target_attempt_id and task_id = target_task_id;

  if worker_record.id is null
     or worker_record.disabled_at is not null
     or worker_record.execution_class <> 'repository_snapshot_github_private_v1'
     or task_record.id is null
     or task_record.execution_class <> 'repository_snapshot_github_private_v1'
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
   where attempt_id = target_attempt_id and task_id = target_task_id;
  if upload_record.attempt_id is null then
    raise exception 'REPOSITORY_SNAPSHOT_ARTIFACT_NOT_AVAILABLE';
  end if;

  return jsonb_build_object(
    'objectKey', upload_record.object_key,
    'createdAt', upload_record.created_at
  );
end;
$$;
revoke all on function private.get_private_repository_snapshot_attempt_artifact(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;

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
  task_class text;
begin
  select execution_class into task_class from private.worker_tasks where id = target_task_id;
  if task_class = 'repository_snapshot_github_private_v1' then
    return private.get_private_repository_snapshot_attempt_artifact(
      target_worker_id, target_task_id, target_attempt_id, target_lease_token
    );
  end if;
  return private.get_repository_snapshot_attempt_artifact_v10a2_base(
    target_worker_id, target_task_id, target_attempt_id, target_lease_token
  );
end;
$$;
revoke all on function public.get_repository_snapshot_attempt_artifact(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_repository_snapshot_attempt_artifact(uuid, uuid, uuid, text)
  to service_role;

-- Preserve the current generic finalizer and route private failures/cancellation to a
-- repository-budget-aware implementation. Successful snapshots must use publication.
alter function public.finalize_worker_attempt(
  uuid, uuid, uuid, text, text, text, text, integer, integer, bigint, bigint, bigint
) rename to finalize_worker_attempt_v10a2_base;
alter function public.finalize_worker_attempt_v10a2_base(
  uuid, uuid, uuid, text, text, text, text, integer, integer, bigint, bigint, bigint
) set schema private;
revoke all on function private.finalize_worker_attempt_v10a2_base(
  uuid, uuid, uuid, text, text, text, text, integer, integer, bigint, bigint, bigint
) from public, anon, authenticated, service_role;

create or replace function private.finalize_private_repository_snapshot_terminal(
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
begin
  if target_lease_token is null or target_lease_token !~ '^[a-f0-9]{64}$'
     or target_terminal_payload_digest is null or target_terminal_payload_digest !~ '^[a-f0-9]{64}$'
     or target_terminal_outcome not in ('failed', 'cancelled')
     or target_wall_time_ms is null or target_wall_time_ms not between 0 and 300000
     or target_cpu_time_ms is null or target_cpu_time_ms not between 0 and 120000
     or target_peak_memory_bytes is null or target_peak_memory_bytes not between 0 and 536870912
     or target_input_bytes is null or target_input_bytes not between 0 and 268435456
     or target_output_bytes is null or target_output_bytes not between 0 and 65536 then
    raise exception 'WORKER_TERMINAL_INVALID';
  end if;
  if target_terminal_outcome = 'failed' and target_failure_code not in (
    'WORKER_LOST', 'WORKER_BUDGET_EXCEEDED', 'WORKER_OUTPUT_INVALID',
    'WORKER_EXECUTION_FAILED', 'WORKER_CLASS_UNAVAILABLE', 'REPOSITORY_UNAVAILABLE',
    'REPOSITORY_IDENTITY_CHANGED', 'REPOSITORY_NETWORK_POLICY_FAILED',
    'REPOSITORY_ARCHIVE_UNSAFE', 'REPOSITORY_ARCHIVE_BUDGET_EXCEEDED',
    'REPOSITORY_ARTIFACT_UPLOAD_FAILED'
  ) then
    raise exception 'WORKER_TERMINAL_INVALID';
  end if;
  if target_terminal_outcome <> 'failed' and target_failure_code is not null then
    raise exception 'WORKER_TERMINAL_INVALID';
  end if;

  calculated_hash := encode(
    extensions.digest(decode(target_lease_token, 'hex'), 'sha256'), 'hex'
  );
  select * into attempt_record
    from private.worker_attempts
   where id = target_attempt_id and task_id = target_task_id
   for update;
  if attempt_record.id is null
     or attempt_record.worker_id <> target_worker_id
     or attempt_record.lease_token_hash <> calculated_hash then
    raise exception 'WORKER_LEASE_INVALID';
  end if;
  if attempt_record.finished_at is not null then
    if attempt_record.terminal_payload_digest = target_terminal_payload_digest
       and attempt_record.outcome in ('failed', 'cancelled') then
      return jsonb_build_object(
        'taskId', target_task_id, 'attemptId', target_attempt_id,
        'outcome', attempt_record.outcome, 'replayed', true
      );
    end if;
    raise exception 'WORKER_TERMINAL_CONFLICT';
  end if;

  select * into worker_record from private.worker_nodes where id = target_worker_id for update;
  select * into task_record from private.worker_tasks where id = target_task_id for update;
  if worker_record.id is null or worker_record.disabled_at is not null
     or worker_record.execution_class <> 'repository_snapshot_github_private_v1'
     or task_record.id is null
     or task_record.execution_class <> 'repository_snapshot_github_private_v1'
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
  if job_record.id is null or job_record.job_kind <> 'repository_snapshot'::public.scan_job_kind then
    raise exception 'WORKER_JOB_STATE_CONFLICT';
  end if;

  if job_record.cancel_requested_at is not null
     or job_record.status = 'cancelled'::public.scan_job_status
     or target_terminal_outcome = 'cancelled' then
    effective_outcome := 'cancelled';
    effective_failure_code := 'WORKER_CANCELLED';
  else
    effective_outcome := 'failed';
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
   where id = attempt_record.id;

  if effective_outcome = 'cancelled' then
    update private.worker_tasks set state = 'cancelled', updated_at = finalize_now
     where id = task_record.id;
    update public.scan_jobs
       set status = 'cancelled'::public.scan_job_status,
           finished_at = finalize_now, failure_code = null
     where id = job_record.id
       and status in ('queued'::public.scan_job_status, 'running'::public.scan_job_status);
    perform private.record_worker_event(
      'worker.cancelled', task_record.workspace_id, worker_record.id, task_record.id,
      jsonb_build_object('attemptId', attempt_record.id)
    );
  elsif task_record.attempt_count < task_record.max_attempts
        and task_record.absolute_deadline_at > finalize_now then
    retry_delay := case task_record.attempt_count
      when 1 then interval '15 seconds'
      when 2 then interval '60 seconds'
      else null
    end;
    if retry_delay is not null and finalize_now + retry_delay < task_record.absolute_deadline_at then
      update private.worker_tasks
         set state = 'retry_wait', available_at = finalize_now + retry_delay, updated_at = finalize_now
       where id = task_record.id;
      perform private.record_worker_event(
        'worker.retry_scheduled', task_record.workspace_id, worker_record.id, task_record.id,
        jsonb_build_object('attemptId', attempt_record.id, 'availableAt', finalize_now + retry_delay)
      );
    else
      update private.worker_tasks set state = 'dead_letter', updated_at = finalize_now
       where id = task_record.id;
      update public.scan_jobs
         set status = 'failed'::public.scan_job_status,
             finished_at = finalize_now, failure_code = 'WORKER_ATTEMPTS_EXHAUSTED'
       where id = job_record.id and status = 'running'::public.scan_job_status;
    end if;
  else
    update private.worker_tasks set state = 'dead_letter', updated_at = finalize_now
     where id = task_record.id;
    update public.scan_jobs
       set status = 'failed'::public.scan_job_status,
           finished_at = finalize_now, failure_code = 'WORKER_ATTEMPTS_EXHAUSTED'
     where id = job_record.id and status = 'running'::public.scan_job_status;
  end if;

  update private.worker_nodes
     set last_seen_at = greatest(coalesce(last_seen_at, finalize_now), finalize_now)
   where id = worker_record.id;

  return jsonb_build_object(
    'taskId', task_record.id, 'attemptId', attempt_record.id,
    'outcome', effective_outcome, 'replayed', false
  );
end;
$$;
revoke all on function private.finalize_private_repository_snapshot_terminal(
  uuid, uuid, uuid, text, text, text, text, integer, integer, bigint, bigint, bigint
) from public, anon, authenticated, service_role;

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
  task_class text;
begin
  select execution_class into task_class from private.worker_tasks where id = target_task_id;
  if task_class = 'repository_snapshot_github_private_v1' then
    if target_terminal_outcome = 'succeeded' then
      raise exception 'REPOSITORY_SNAPSHOT_PUBLICATION_REQUIRED';
    end if;
    return private.finalize_private_repository_snapshot_terminal(
      target_worker_id, target_task_id, target_attempt_id, target_lease_token,
      target_terminal_outcome, target_failure_code, target_terminal_payload_digest,
      target_wall_time_ms, target_cpu_time_ms, target_peak_memory_bytes,
      target_input_bytes, target_output_bytes
    );
  end if;
  return private.finalize_worker_attempt_v10a2_base(
    target_worker_id, target_task_id, target_attempt_id, target_lease_token,
    target_terminal_outcome, target_failure_code, target_terminal_payload_digest,
    target_wall_time_ms, target_cpu_time_ms, target_peak_memory_bytes,
    target_input_bytes, target_output_bytes
  );
end;
$$;
revoke all on function public.finalize_worker_attempt(
  uuid, uuid, uuid, text, text, text, text, integer, integer, bigint, bigint, bigint
) from public, anon, authenticated, service_role;
grant execute on function public.finalize_worker_attempt(
  uuid, uuid, uuid, text, text, text, text, integer, integer, bigint, bigint, bigint
) to service_role;

-- Keep the hardened public publication function intact and add a private-only publisher.
create or replace function private.finalize_private_repository_snapshot_worker_attempt(
  target_worker_id uuid,
  target_task_id uuid,
  target_attempt_id uuid,
  target_lease_token text,
  target_terminal_payload_digest text,
  target_canonical_repository_url text,
  target_default_branch text,
  target_resolved_commit_sha text,
  target_content_digest text,
  target_artifact_digest text,
  target_compressed_bytes bigint,
  target_expanded_bytes bigint,
  target_retained_file_count integer,
  target_retained_bytes bigint,
  target_stored_artifact_bytes bigint,
  target_skip_counts jsonb,
  target_wall_time_ms integer,
  target_cpu_time_ms integer,
  target_peak_memory_bytes bigint,
  target_input_bytes bigint,
  target_output_bytes bigint,
  target_server_observed_object_bytes bigint
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
  repository_task private.repository_snapshot_tasks%rowtype;
  upload_record private.repository_snapshot_attempt_uploads%rowtype;
  existing_snapshot public.repository_source_snapshots%rowtype;
  snapshot_record public.repository_source_snapshots%rowtype;
  publish_now timestamptz := now();
  calculated_hash text;
begin
  if target_lease_token is null or target_lease_token !~ '^[a-f0-9]{64}$'
     or target_terminal_payload_digest is null or target_terminal_payload_digest !~ '^[a-f0-9]{64}$'
     or target_canonical_repository_url is null
     or char_length(target_canonical_repository_url) not between 1 and 512
     or target_canonical_repository_url !~ '^https://github[.]com/[^/?#]+/[^/?#]+$'
     or target_default_branch is null or octet_length(target_default_branch) not between 1 and 255
     or target_resolved_commit_sha is null or target_resolved_commit_sha !~ '^[a-f0-9]{40}$'
     or target_content_digest is null or target_content_digest !~ '^[a-f0-9]{64}$'
     or target_artifact_digest is null or target_artifact_digest !~ '^[a-f0-9]{64}$'
     or target_compressed_bytes is null or target_compressed_bytes not between 0 and 134217728
     or target_expanded_bytes is null or target_expanded_bytes not between 0 and 536870912
     or target_retained_file_count is null or target_retained_file_count not between 0 and 20000
     or target_retained_bytes is null or target_retained_bytes not between 0 and 268435456
     or target_stored_artifact_bytes is null or target_stored_artifact_bytes not between 1 and 335544320
     or target_server_observed_object_bytes is null or target_server_observed_object_bytes not between 1 and 335544320
     or target_server_observed_object_bytes <> target_stored_artifact_bytes
     or target_expanded_bytes < target_retained_bytes
     or target_wall_time_ms is null or target_wall_time_ms not between 0 and 300000
     or target_cpu_time_ms is null or target_cpu_time_ms not between 0 and 120000
     or target_peak_memory_bytes is null or target_peak_memory_bytes not between 0 and 536870912
     or target_input_bytes is null or target_input_bytes not between 0 and 268435456
     or target_output_bytes is null or target_output_bytes not between 0 and 65536 then
    raise exception 'REPOSITORY_SNAPSHOT_TERMINAL_INVALID';
  end if;

  if jsonb_typeof(target_skip_counts) is distinct from 'object'
     or not (target_skip_counts ?& array['symlink','hardlink','fileTooLarge','retainedFileLimit','retainedBytesLimit'])
     or (target_skip_counts - array['symlink','hardlink','fileTooLarge','retainedFileLimit','retainedBytesLimit']) <> '{}'::jsonb
     or pg_column_size(target_skip_counts) > 1024
     or (target_skip_counts->>'symlink') !~ '^[0-9]+$'
     or (target_skip_counts->>'hardlink') !~ '^[0-9]+$'
     or (target_skip_counts->>'fileTooLarge') !~ '^[0-9]+$'
     or (target_skip_counts->>'retainedFileLimit') !~ '^[0-9]+$'
     or (target_skip_counts->>'retainedBytesLimit') !~ '^[0-9]+$' then
    raise exception 'REPOSITORY_SNAPSHOT_TERMINAL_INVALID';
  end if;

  calculated_hash := encode(
    extensions.digest(decode(target_lease_token, 'hex'), 'sha256'), 'hex'
  );
  select * into attempt_record
    from private.worker_attempts
   where id = target_attempt_id and task_id = target_task_id
   for update;
  if attempt_record.id is null
     or attempt_record.worker_id <> target_worker_id
     or attempt_record.lease_token_hash <> calculated_hash then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  if attempt_record.finished_at is not null then
    if attempt_record.terminal_payload_digest = target_terminal_payload_digest
       and attempt_record.outcome = 'succeeded' then
      select * into existing_snapshot
        from public.repository_source_snapshots
       where scan_job_id = (select scan_job_id from private.worker_tasks where id = target_task_id);
      if existing_snapshot.id is null
         or existing_snapshot.source_kind <> 'github_private_archive'
         or existing_snapshot.canonical_repository_url <> target_canonical_repository_url
         or existing_snapshot.default_branch <> target_default_branch
         or existing_snapshot.resolved_commit_sha <> target_resolved_commit_sha
         or existing_snapshot.content_digest <> target_content_digest
         or existing_snapshot.artifact_digest <> target_artifact_digest
         or existing_snapshot.compressed_bytes <> target_compressed_bytes
         or existing_snapshot.expanded_bytes <> target_expanded_bytes
         or existing_snapshot.retained_file_count <> target_retained_file_count
         or existing_snapshot.retained_bytes <> target_retained_bytes
         or existing_snapshot.stored_artifact_bytes <> target_stored_artifact_bytes
         or existing_snapshot.skip_counts <> target_skip_counts then
        raise exception 'REPOSITORY_SNAPSHOT_TERMINAL_CONFLICT';
      end if;
      return jsonb_build_object(
        'taskId', target_task_id, 'attemptId', target_attempt_id,
        'snapshotId', existing_snapshot.id, 'outcome', 'succeeded', 'replayed', true
      );
    end if;
    raise exception 'REPOSITORY_SNAPSHOT_TERMINAL_CONFLICT';
  end if;

  select * into worker_record from private.worker_nodes where id = target_worker_id for update;
  select * into task_record from private.worker_tasks where id = target_task_id for update;
  if worker_record.id is null or worker_record.disabled_at is not null
     or worker_record.execution_class <> 'repository_snapshot_github_private_v1'
     or task_record.id is null
     or task_record.execution_class <> 'repository_snapshot_github_private_v1'
     or task_record.state <> 'leased'
     or attempt_record.lease_expires_at <= publish_now then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  select * into job_record
    from public.scan_jobs
   where id = task_record.scan_job_id
     and workspace_id = task_record.workspace_id
     and asset_id = task_record.asset_id
   for update;
  select * into repository_task
    from private.repository_snapshot_tasks
   where task_id = task_record.id
     and scan_job_id = task_record.scan_job_id
     and workspace_id = task_record.workspace_id
     and asset_id = task_record.asset_id;
  select * into upload_record
    from private.repository_snapshot_attempt_uploads
   where attempt_id = attempt_record.id and task_id = task_record.id;

  if job_record.id is null
     or job_record.job_kind <> 'repository_snapshot'::public.scan_job_kind
     or job_record.status <> 'running'::public.scan_job_status
     or repository_task.task_id is null
     or repository_task.github_repository_link_id is null
     or upload_record.attempt_id is null
     or repository_task.canonical_repository_url <> target_canonical_repository_url then
    raise exception 'REPOSITORY_SNAPSHOT_TERMINAL_INVALID';
  end if;

  if exists (select 1 from public.repository_source_snapshots where scan_job_id = job_record.id) then
    raise exception 'REPOSITORY_SNAPSHOT_TERMINAL_CONFLICT';
  end if;

  insert into public.repository_source_snapshots (
    workspace_id, asset_id, scan_job_id, requested_by, source_kind, schema_version,
    canonical_repository_url, default_branch, resolved_commit_sha,
    content_digest, artifact_digest, compressed_bytes, expanded_bytes,
    retained_file_count, retained_bytes, stored_artifact_bytes, skip_counts,
    created_at, expires_at
  ) values (
    task_record.workspace_id, task_record.asset_id, task_record.scan_job_id,
    repository_task.requested_by, 'github_private_archive', 1,
    target_canonical_repository_url, target_default_branch, target_resolved_commit_sha,
    target_content_digest, target_artifact_digest, target_compressed_bytes,
    target_expanded_bytes, target_retained_file_count, target_retained_bytes,
    target_stored_artifact_bytes, target_skip_counts,
    publish_now, publish_now + interval '7 days'
  ) returning * into snapshot_record;

  insert into private.repository_source_artifacts (
    snapshot_id, provider, object_key, stored_byte_count, artifact_digest,
    expires_at, deletion_status, deleted_at, created_at
  ) values (
    snapshot_record.id, 'r2', upload_record.object_key,
    target_server_observed_object_bytes, target_artifact_digest,
    snapshot_record.expires_at, 'active', null, publish_now
  );

  update private.worker_attempts
     set finished_at = publish_now, outcome = 'succeeded', failure_code = null,
         terminal_payload_digest = target_terminal_payload_digest,
         wall_time_ms = target_wall_time_ms, cpu_time_ms = target_cpu_time_ms,
         peak_memory_bytes = target_peak_memory_bytes, input_bytes = target_input_bytes,
         output_bytes = target_output_bytes
   where id = attempt_record.id;
  update private.worker_tasks set state = 'completed', updated_at = publish_now
   where id = task_record.id;
  update public.scan_jobs
     set status = 'succeeded'::public.scan_job_status,
         finished_at = publish_now, failure_code = null,
         request_count = 0, redirect_count = 0, finding_count = 0
   where id = job_record.id and status = 'running'::public.scan_job_status;
  if not found then
    raise exception 'REPOSITORY_SNAPSHOT_TERMINAL_CONFLICT';
  end if;

  update private.worker_nodes
     set last_seen_at = greatest(coalesce(last_seen_at, publish_now), publish_now)
   where id = worker_record.id;

  perform private.record_worker_event(
    'worker.succeeded', task_record.workspace_id, worker_record.id, task_record.id,
    jsonb_build_object(
      'attemptId', attempt_record.id,
      'snapshotId', snapshot_record.id,
      'sourceKind', 'github_private_archive'
    )
  );

  return jsonb_build_object(
    'taskId', task_record.id, 'attemptId', attempt_record.id,
    'snapshotId', snapshot_record.id, 'outcome', 'succeeded', 'replayed', false
  );
end;
$$;
revoke all on function private.finalize_private_repository_snapshot_worker_attempt(
  uuid, uuid, uuid, text, text, text, text, text, text, text,
  bigint, bigint, integer, bigint, bigint, jsonb,
  integer, integer, bigint, bigint, bigint, bigint
) from public, anon, authenticated, service_role;

-- Move the hardened public wrapper aside, then expose one class-aware publication entry point.
alter function public.finalize_repository_snapshot_worker_attempt(
  uuid, uuid, uuid, text, text, text, text, text, text, text,
  bigint, bigint, integer, bigint, bigint, jsonb,
  integer, integer, bigint, bigint, bigint, bigint
) rename to finalize_repository_snapshot_worker_attempt_v10a2_public;
alter function public.finalize_repository_snapshot_worker_attempt_v10a2_public(
  uuid, uuid, uuid, text, text, text, text, text, text, text,
  bigint, bigint, integer, bigint, bigint, jsonb,
  integer, integer, bigint, bigint, bigint, bigint
) set schema private;
revoke all on function private.finalize_repository_snapshot_worker_attempt_v10a2_public(
  uuid, uuid, uuid, text, text, text, text, text, text, text,
  bigint, bigint, integer, bigint, bigint, jsonb,
  integer, integer, bigint, bigint, bigint, bigint
) from public, anon, authenticated, service_role;

create or replace function public.finalize_repository_snapshot_worker_attempt(
  target_worker_id uuid,
  target_task_id uuid,
  target_attempt_id uuid,
  target_lease_token text,
  target_terminal_payload_digest text,
  target_canonical_repository_url text,
  target_default_branch text,
  target_resolved_commit_sha text,
  target_content_digest text,
  target_artifact_digest text,
  target_compressed_bytes bigint,
  target_expanded_bytes bigint,
  target_retained_file_count integer,
  target_retained_bytes bigint,
  target_stored_artifact_bytes bigint,
  target_skip_counts jsonb,
  target_wall_time_ms integer,
  target_cpu_time_ms integer,
  target_peak_memory_bytes bigint,
  target_input_bytes bigint,
  target_output_bytes bigint,
  target_server_observed_object_bytes bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  task_class text;
  job_cancelled boolean := false;
begin
  select t.execution_class,
         (j.cancel_requested_at is not null or j.status = 'cancelled'::public.scan_job_status)
    into task_class, job_cancelled
    from private.worker_tasks t
    join public.scan_jobs j
      on j.id = t.scan_job_id
     and j.workspace_id = t.workspace_id
     and j.asset_id = t.asset_id
   where t.id = target_task_id;

  if task_class = 'repository_snapshot_github_private_v1' then
    if job_cancelled then
      return public.finalize_worker_attempt(
        target_worker_id, target_task_id, target_attempt_id, target_lease_token,
        'cancelled', null, target_terminal_payload_digest,
        target_wall_time_ms, target_cpu_time_ms, target_peak_memory_bytes,
        target_input_bytes, target_output_bytes
      );
    end if;
    return private.finalize_private_repository_snapshot_worker_attempt(
      target_worker_id, target_task_id, target_attempt_id, target_lease_token,
      target_terminal_payload_digest, target_canonical_repository_url,
      target_default_branch, target_resolved_commit_sha, target_content_digest,
      target_artifact_digest, target_compressed_bytes, target_expanded_bytes,
      target_retained_file_count, target_retained_bytes, target_stored_artifact_bytes,
      target_skip_counts, target_wall_time_ms, target_cpu_time_ms,
      target_peak_memory_bytes, target_input_bytes, target_output_bytes,
      target_server_observed_object_bytes
    );
  end if;

  return private.finalize_repository_snapshot_worker_attempt_v10a2_public(
    target_worker_id, target_task_id, target_attempt_id, target_lease_token,
    target_terminal_payload_digest, target_canonical_repository_url,
    target_default_branch, target_resolved_commit_sha, target_content_digest,
    target_artifact_digest, target_compressed_bytes, target_expanded_bytes,
    target_retained_file_count, target_retained_bytes, target_stored_artifact_bytes,
    target_skip_counts, target_wall_time_ms, target_cpu_time_ms,
    target_peak_memory_bytes, target_input_bytes, target_output_bytes,
    target_server_observed_object_bytes
  );
end;
$$;
revoke all on function public.finalize_repository_snapshot_worker_attempt(
  uuid, uuid, uuid, text, text, text, text, text, text, text,
  bigint, bigint, integer, bigint, bigint, jsonb,
  integer, integer, bigint, bigint, bigint, bigint
) from public, anon, authenticated, service_role;
grant execute on function public.finalize_repository_snapshot_worker_attempt(
  uuid, uuid, uuid, text, text, text, text, text, text, text,
  bigint, bigint, integer, bigint, bigint, jsonb,
  integer, integer, bigint, bigint, bigint, bigint
) to service_role;
