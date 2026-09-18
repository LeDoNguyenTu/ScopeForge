-- Phase 11C: source-only HTTP discovery worker queue/control persistence.
-- Forward-only. Committing this migration does not authorize production application
-- or hosted execution of the phase11_http_discovery_v1 class.

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
      'active_cors_validation_v1',
      'phase11_http_discovery_v1'
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
      'active_cors_validation_v1',
      'phase11_http_discovery_v1'
    )
  ),
  alter column scan_job_id drop not null,
  alter column asset_id drop not null;

alter table private.worker_tasks
  add constraint worker_tasks_phase11_domain_check check (
    (
      execution_class = 'phase11_http_discovery_v1'
      and scan_job_id is null
      and asset_id is null
    )
    or (
      execution_class <> 'phase11_http_discovery_v1'
      and scan_job_id is not null
      and asset_id is not null
    )
  ),
  add constraint worker_tasks_phase11_single_attempt_check check (
    execution_class <> 'phase11_http_discovery_v1' or max_attempts = 1
  ),
  add constraint worker_tasks_phase11_deadline_check check (
    execution_class <> 'phase11_http_discovery_v1'
    or absolute_deadline_at = created_at + interval '30 seconds'
  );

create table private.phase11_http_worker_tasks (
  task_id uuid primary key references private.worker_tasks(id) on delete cascade,
  workspace_id uuid not null,
  run_id uuid not null,
  action_id text not null,
  authorization_id text not null,
  authorization_snapshot_ref text not null,
  target_node_id text not null,
  capability_id text not null check (
    capability_id in ('web.http.probe.v1', 'web.route.discover.v1')
  ),
  capability_version text not null check (capability_version = '1.0.0'),
  provider_id text not null check (provider_id = 'scopeforge.http-discovery'),
  provider_version text not null check (provider_version = '1.0.0'),
  schema_version smallint not null default 1 check (schema_version = 1),
  created_at timestamptz not null default now(),
  constraint phase11_http_worker_tasks_action_fkey
    foreign key (workspace_id, run_id, action_id)
    references private.pentest_actions(workspace_id, run_id, action_id)
    on delete cascade,
  constraint phase11_http_worker_tasks_target_fkey
    foreign key (workspace_id, run_id, target_node_id)
    references private.pentest_graph_nodes(workspace_id, run_id, node_id)
    on delete restrict,
  constraint phase11_http_worker_tasks_authorization_key unique (authorization_id),
  check (authorization_id ~ '^phase11-authz:[0-9a-f]{64}$'),
  check (char_length(authorization_snapshot_ref) between 1 and 512)
);

create index phase11_http_worker_tasks_action_idx
  on private.phase11_http_worker_tasks(workspace_id, run_id, action_id);

create or replace function private.guard_phase11_http_worker_task_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Phase 11 HTTP worker task bindings are immutable';
end;
$$;

create trigger phase11_http_worker_tasks_guard_update
before update on private.phase11_http_worker_tasks
for each row execute function private.guard_phase11_http_worker_task_update();

alter table private.phase11_http_worker_tasks enable row level security;

revoke all on table private.phase11_http_worker_tasks from public, anon, authenticated, service_role;
revoke all on function private.guard_phase11_http_worker_task_update()
  from public, anon, authenticated, service_role;

create or replace function public.enqueue_phase11_http_worker_task(
  target_workspace_id uuid,
  target_run_id uuid,
  target_action_id text,
  target_authorization_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_now timestamptz := clock_timestamp();
  run_record private.pentest_runs%rowtype;
  action_record private.pentest_actions%rowtype;
  snapshot_record private.pentest_run_authorization_snapshots%rowtype;
  target_record private.pentest_graph_nodes%rowtype;
  existing_binding private.phase11_http_worker_tasks%rowtype;
  new_task_id uuid;
  target_node_id text;
  parameter_count integer;
  required_requests integer;
begin
  if target_workspace_id is null
    or target_run_id is null
    or target_action_id is null
    or target_action_id !~ '^phase11-action:[0-9a-f]{64}$'
    or target_authorization_id is null
    or target_authorization_id !~ '^phase11-authz:[0-9a-f]{64}$'
  then
    raise exception 'PHASE11_HTTP_QUEUE_IDENTITY_INVALID';
  end if;

  select *
  into run_record
  from private.pentest_runs
  where id = target_run_id
    and workspace_id = target_workspace_id
  for update;

  if not found then
    raise exception 'PHASE11_HTTP_RUN_NOT_FOUND';
  end if;
  if run_record.status <> 'running' then
    raise exception 'PHASE11_HTTP_RUN_NOT_ACTIVE';
  end if;

  select *
  into action_record
  from private.pentest_actions
  where workspace_id = target_workspace_id
    and run_id = target_run_id
    and action_id = target_action_id
  for update;

  if not found then
    raise exception 'PHASE11_HTTP_ACTION_NOT_FOUND';
  end if;

  select *
  into existing_binding
  from private.phase11_http_worker_tasks
  where authorization_id = target_authorization_id;

  if (not found and action_record.state <> 'enqueueing')
    or (found and action_record.state <> 'queued')
  then
    raise exception 'PHASE11_HTTP_ACTION_NOT_ENQUEUEING';
  end if;
  if action_record.decision_status not in ('approved', 'narrowed') then
    raise exception 'PHASE11_HTTP_ACTION_NOT_AUTHORIZED';
  end if;
  if action_record.authorization_id is distinct from target_authorization_id then
    raise exception 'PHASE11_HTTP_AUTHORIZATION_ID_MISMATCH';
  end if;
  if action_record.authorization_snapshot_ref is distinct from run_record.authorization_snapshot_ref then
    raise exception 'PHASE11_HTTP_AUTHORIZATION_SNAPSHOT_MISMATCH';
  end if;
  if action_record.authorization_expires_at is null
    or action_record.authorization_expires_at <= request_now
  then
    raise exception 'PHASE11_HTTP_AUTHORIZATION_EXPIRED';
  end if;

  select *
  into snapshot_record
  from private.pentest_run_authorization_snapshots
  where workspace_id = target_workspace_id
    and run_id = target_run_id
    and snapshot_ref = action_record.authorization_snapshot_ref;

  if not found
    or snapshot_record.expires_at <= request_now
    or action_record.authorization_expires_at > snapshot_record.expires_at
  then
    raise exception 'PHASE11_HTTP_AUTHORIZATION_EXPIRED';
  end if;
  if action_record.requested_mode <> 'safe_active'
    or snapshot_record.max_execution_mode not in ('safe_active', 'intrusive', 'validation')
  then
    raise exception 'PHASE11_HTTP_EXECUTION_MODE_INVALID';
  end if;
  if action_record.capability_id not in ('web.http.probe.v1', 'web.route.discover.v1')
    or action_record.capability_version <> '1.0.0'
  then
    raise exception 'PHASE11_HTTP_CAPABILITY_IDENTITY_INVALID';
  end if;
  if cardinality(action_record.target_node_ids) <> 1 then
    raise exception 'PHASE11_HTTP_TARGET_CARDINALITY_INVALID';
  end if;

  target_node_id := action_record.target_node_ids[1];
  if not (target_node_id = any(snapshot_record.authorized_node_ids)) then
    raise exception 'PHASE11_HTTP_TARGET_OUTSIDE_AUTHORIZATION';
  end if;

  select *
  into target_record
  from private.pentest_graph_nodes
  where workspace_id = target_workspace_id
    and run_id = target_run_id
    and node_id = target_node_id;

  if not found
    or target_record.authorization_ref is distinct from action_record.authorization_snapshot_ref
  then
    raise exception 'PHASE11_HTTP_TARGET_OUTSIDE_AUTHORIZATION';
  end if;

  select count(*)::integer
  into parameter_count
  from jsonb_object_keys(action_record.closed_parameters);

  if parameter_count <> 3
    or not (action_record.closed_parameters ?& array[
      'discoveryProfile', 'methodProfile', 'followSameOriginRedirects'
    ])
    or jsonb_typeof(action_record.closed_parameters->'discoveryProfile') <> 'string'
    or action_record.closed_parameters->>'discoveryProfile' not in ('root-only', 'well-known-safe')
    or (action_record.capability_id = 'web.http.probe.v1'
      and action_record.closed_parameters->>'discoveryProfile' <> 'root-only')
    or jsonb_typeof(action_record.closed_parameters->'methodProfile') <> 'string'
    or action_record.closed_parameters->>'methodProfile' not in ('GET_ONLY', 'HEAD_THEN_GET')
    or jsonb_typeof(action_record.closed_parameters->'followSameOriginRedirects') <> 'boolean'
  then
    raise exception 'PHASE11_HTTP_CLOSED_PARAMETERS_INVALID';
  end if;

  required_requests :=
    case action_record.closed_parameters->>'discoveryProfile'
      when 'root-only' then 1 else 4
    end
    * (
      case action_record.closed_parameters->>'methodProfile'
        when 'HEAD_THEN_GET' then 2 else 1
      end
      + case
          when (action_record.closed_parameters->>'followSameOriginRedirects')::boolean then 1
          else 0
        end
    );

  if action_record.max_requests is null
    or action_record.max_requests < required_requests
    or action_record.max_requests > 12
    or action_record.max_runtime_ms is null
    or action_record.max_runtime_ms < 1
    or action_record.max_runtime_ms > 30000
  then
    raise exception 'PHASE11_HTTP_ACTION_BUDGET_INVALID';
  end if;

  if existing_binding.task_id is not null then
    if existing_binding.workspace_id is distinct from target_workspace_id
      or existing_binding.run_id is distinct from target_run_id
      or existing_binding.action_id is distinct from target_action_id
      or existing_binding.authorization_snapshot_ref is distinct from action_record.authorization_snapshot_ref
      or existing_binding.target_node_id is distinct from target_node_id
      or existing_binding.capability_id is distinct from action_record.capability_id
      or existing_binding.capability_version <> '1.0.0'
      or existing_binding.provider_id <> 'scopeforge.http-discovery'
      or existing_binding.provider_version <> '1.0.0'
      or existing_binding.schema_version <> 1
      or action_record.queue_reference is distinct from
        'phase11-http-worker:' || existing_binding.task_id::text
    then
      raise exception 'PHASE11_HTTP_WORKER_IDENTITY_CONFLICT';
    end if;
    return jsonb_build_object(
      'taskId', existing_binding.task_id,
      'replayed', true
    );
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
    absolute_deadline_at,
    created_at,
    updated_at
  ) values (
    null,
    target_workspace_id,
    null,
    'phase11_http_discovery_v1',
    'queued',
    0,
    request_now,
    0,
    1,
    request_now + interval '30 seconds',
    request_now,
    request_now
  ) returning id into new_task_id;

  insert into private.phase11_http_worker_tasks (
    task_id,
    workspace_id,
    run_id,
    action_id,
    authorization_id,
    authorization_snapshot_ref,
    target_node_id,
    capability_id,
    capability_version,
    provider_id,
    provider_version,
    schema_version,
    created_at
  ) values (
    new_task_id,
    target_workspace_id,
    target_run_id,
    target_action_id,
    target_authorization_id,
    action_record.authorization_snapshot_ref,
    target_node_id,
    action_record.capability_id,
    '1.0.0',
    'scopeforge.http-discovery',
    '1.0.0',
    1,
    request_now
  );

  update private.pentest_actions
  set state = 'queued',
      enqueue_token = null,
      queue_reference = 'phase11-http-worker:' || new_task_id::text,
      updated_at = request_now
  where workspace_id = target_workspace_id
    and run_id = target_run_id
    and action_id = target_action_id;

  update public.pentest_action_summaries
  set state = 'queued',
      updated_at = request_now
  where workspace_id = target_workspace_id
    and run_id = target_run_id
    and action_id = target_action_id;

  return jsonb_build_object(
    'taskId', new_task_id,
    'replayed', false
  );
end;
$$;

revoke all on function public.enqueue_phase11_http_worker_task(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.enqueue_phase11_http_worker_task(uuid, uuid, text, text)
  to service_role;

create or replace function public.register_phase11_http_worker_node(
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
    or char_length(target_software_version) > 64
  then
    raise exception 'WORKER_VERSION_INVALID';
  end if;

  insert into private.worker_nodes (
    credential_hash,
    execution_class,
    software_version
  ) values (
    target_credential_hash,
    'phase11_http_discovery_v1',
    target_software_version
  ) returning * into worker_record;

  perform private.record_worker_event(
    'worker.node_registered',
    null,
    worker_record.id,
    null,
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

create or replace function public.claim_phase11_http_worker_task(
  target_worker_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim_now timestamptz;
  worker_record private.worker_nodes%rowtype;
  task_record private.worker_tasks%rowtype;
  attempt_record private.worker_attempts%rowtype;
  binding_record private.phase11_http_worker_tasks%rowtype;
  lease_token bytea;
  lease_token_text text;
begin
  select *
  into worker_record
  from private.worker_nodes
  where id = target_worker_id
  for update;

  if worker_record.id is null
    or worker_record.disabled_at is not null
    or worker_record.execution_class <> 'phase11_http_discovery_v1'
  then
    raise exception 'RUNTIME_WORKER_ACCESS_DENIED';
  end if;

  select t.*
  into task_record
  from private.worker_tasks t
  join private.phase11_http_worker_tasks binding
    on binding.task_id = t.id
   and binding.workspace_id = t.workspace_id
  join private.pentest_actions action
    on action.workspace_id = binding.workspace_id
   and action.run_id = binding.run_id
   and action.action_id = binding.action_id
   and action.authorization_id = binding.authorization_id
   and action.authorization_snapshot_ref = binding.authorization_snapshot_ref
  join private.pentest_runs run
    on run.id = binding.run_id
   and run.workspace_id = binding.workspace_id
   and run.authorization_snapshot_ref = binding.authorization_snapshot_ref
  join private.pentest_run_authorization_snapshots snapshot
    on snapshot.workspace_id = binding.workspace_id
   and snapshot.run_id = binding.run_id
   and snapshot.snapshot_ref = binding.authorization_snapshot_ref
  where t.execution_class = 'phase11_http_discovery_v1'
    and t.state = 'queued'
    and t.attempt_count = 0
    and t.max_attempts = 1
    and t.available_at <= clock_timestamp()
    and t.absolute_deadline_at > clock_timestamp()
    and action.state = 'queued'
    and action.decision_status in ('approved', 'narrowed')
    and action.requested_mode = 'safe_active'
    and action.authorization_expires_at > clock_timestamp()
    and snapshot.expires_at > clock_timestamp()
    and run.status = 'running'
    and not exists (
      select 1
      from private.worker_tasks active_task
      where active_task.execution_class = 'phase11_http_discovery_v1'
        and active_task.state = 'leased'
    )
  order by t.priority desc, t.available_at asc, t.created_at asc, t.id asc
  for update of t skip locked
  limit 1;

  if task_record.id is null then
    return null;
  end if;

  select *
  into binding_record
  from private.phase11_http_worker_tasks
  where task_id = task_record.id;

  claim_now := clock_timestamp();
  if binding_record.task_id is null
    or task_record.absolute_deadline_at <= claim_now
  then
    return null;
  end if;

  lease_token := extensions.gen_random_bytes(32);
  lease_token_text := encode(lease_token, 'hex');

  update private.worker_tasks
  set state = 'leased',
      attempt_count = task_record.attempt_count + 1,
      updated_at = claim_now
  where id = task_record.id
    and state = 'queued'
    and attempt_count = 0
    and max_attempts = 1
    and absolute_deadline_at > claim_now
  returning * into task_record;

  if task_record.id is null then
    return null;
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
    task_record.absolute_deadline_at,
    claim_now
  ) returning * into attempt_record;

  update private.pentest_actions
  set state = 'running',
      updated_at = claim_now
  where workspace_id = binding_record.workspace_id
    and run_id = binding_record.run_id
    and action_id = binding_record.action_id
    and authorization_id = binding_record.authorization_id
    and state = 'queued';

  if not found then
    raise exception 'WORKER_JOB_STATE_CONFLICT';
  end if;

  update public.pentest_action_summaries
  set state = 'running',
      updated_at = claim_now
  where workspace_id = binding_record.workspace_id
    and run_id = binding_record.run_id
    and action_id = binding_record.action_id;

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
    'absoluteDeadlineAt', task_record.absolute_deadline_at,
    'budget', jsonb_build_object(
      'maxWallTimeMs', 30000,
      'maxCpuTimeMs', 15000,
      'maxMemoryBytes', 268435456,
      'maxProcesses', 1,
      'maxInputFiles', 0,
      'maxInputBytes', 4096,
      'maxScratchBytes', 8388608,
      'maxOutputBytes', 32768
    ),
    'input', jsonb_build_object(
      'kind', 'phase11_http_discovery',
      'runId', binding_record.run_id,
      'actionId', binding_record.action_id,
      'authorizationId', binding_record.authorization_id
    )
  );
end;
$$;

revoke all on function public.register_phase11_http_worker_node(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.register_phase11_http_worker_node(text, text)
  to service_role;

revoke all on function public.claim_phase11_http_worker_task(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_phase11_http_worker_task(uuid)
  to service_role;

create or replace function public.get_phase11_http_worker_preparation_context(
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
  lookup_now timestamptz := clock_timestamp();
  calculated_hash text;
  worker_record private.worker_nodes%rowtype;
  task_record private.worker_tasks%rowtype;
  attempt_record private.worker_attempts%rowtype;
  binding_record private.phase11_http_worker_tasks%rowtype;
  run_record private.pentest_runs%rowtype;
  action_record private.pentest_actions%rowtype;
  snapshot_record private.pentest_run_authorization_snapshots%rowtype;
  target_record private.pentest_graph_nodes%rowtype;
begin
  if target_worker_id is null
    or target_task_id is null
    or target_attempt_id is null
    or target_lease_token is null
    or target_lease_token !~ '^[a-f0-9]{64}$'
  then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  calculated_hash := encode(
    extensions.digest(decode(target_lease_token, 'hex'), 'sha256'),
    'hex'
  );

  select *
  into worker_record
  from private.worker_nodes
  where id = target_worker_id;

  select *
  into task_record
  from private.worker_tasks
  where id = target_task_id;

  select *
  into attempt_record
  from private.worker_attempts
  where id = target_attempt_id
    and task_id = target_task_id;

  select *
  into binding_record
  from private.phase11_http_worker_tasks
  where task_id = target_task_id;

  if worker_record.id is null
    or worker_record.disabled_at is not null
    or worker_record.execution_class <> 'phase11_http_discovery_v1'
    or task_record.id is null
    or task_record.execution_class <> 'phase11_http_discovery_v1'
    or task_record.workspace_id is distinct from binding_record.workspace_id
    or task_record.scan_job_id is not null
    or task_record.asset_id is not null
    or task_record.state <> 'leased'
    or task_record.absolute_deadline_at <= lookup_now
    or binding_record.task_id is null
    or attempt_record.id is null
    or attempt_record.worker_id is distinct from target_worker_id
    or attempt_record.lease_token_hash is distinct from calculated_hash
    or attempt_record.finished_at is not null
    or attempt_record.lease_expires_at <= lookup_now
  then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  select *
  into run_record
  from private.pentest_runs
  where id = binding_record.run_id
    and workspace_id = binding_record.workspace_id
  for update;

  select *
  into action_record
  from private.pentest_actions
  where workspace_id = binding_record.workspace_id
    and run_id = binding_record.run_id
    and action_id = binding_record.action_id
  for update;

  if run_record.id is null
    or run_record.status <> 'running'
    or action_record.action_id is null
    or action_record.state not in ('queued', 'running')
    or action_record.decision_status not in ('approved', 'narrowed')
    or action_record.authorization_id is distinct from binding_record.authorization_id
    or run_record.authorization_snapshot_ref is distinct from binding_record.authorization_snapshot_ref
    or action_record.authorization_snapshot_ref is distinct from binding_record.authorization_snapshot_ref
    or action_record.capability_id is distinct from binding_record.capability_id
    or action_record.capability_version is distinct from binding_record.capability_version
    or cardinality(action_record.target_node_ids) <> 1
    or action_record.target_node_ids[1] is distinct from binding_record.target_node_id
    or action_record.requested_mode <> 'safe_active'
  then
    raise exception 'PHASE11_HTTP_WORKER_BINDING_MISMATCH';
  end if;

  select *
  into snapshot_record
  from private.pentest_run_authorization_snapshots
  where workspace_id = binding_record.workspace_id
    and run_id = binding_record.run_id
    and snapshot_ref = binding_record.authorization_snapshot_ref;

  if snapshot_record.snapshot_ref is null
    or snapshot_record.expires_at <= lookup_now
    or action_record.authorization_expires_at is null
    or action_record.authorization_expires_at <= lookup_now
    or action_record.authorization_expires_at > snapshot_record.expires_at
  then
    raise exception 'PHASE11_HTTP_AUTHORIZATION_EXPIRED';
  end if;
  if not (binding_record.target_node_id = any(snapshot_record.authorized_node_ids)) then
    raise exception 'PHASE11_HTTP_TARGET_OUTSIDE_AUTHORIZATION';
  end if;

  select *
  into target_record
  from private.pentest_graph_nodes
  where workspace_id = binding_record.workspace_id
    and run_id = binding_record.run_id
    and node_id = binding_record.target_node_id;

  if target_record.node_id is null
    or target_record.authorization_ref is distinct from binding_record.authorization_snapshot_ref
  then
    raise exception 'PHASE11_HTTP_TARGET_OUTSIDE_AUTHORIZATION';
  end if;

  return jsonb_build_object(
    'binding', jsonb_build_object(
      'taskId', binding_record.task_id,
      'workspaceId', binding_record.workspace_id,
      'runId', binding_record.run_id,
      'actionId', binding_record.action_id,
      'authorizationId', binding_record.authorization_id,
      'authorizationSnapshotRef', binding_record.authorization_snapshot_ref,
      'targetNodeId', binding_record.target_node_id,
      'capabilityId', binding_record.capability_id,
      'capabilityVersion', binding_record.capability_version,
      'providerId', binding_record.provider_id,
      'providerVersion', binding_record.provider_version
    ),
    'run', jsonb_build_object(
      'status', run_record.status,
      'authorizationSnapshotRef', run_record.authorization_snapshot_ref
    ),
    'snapshot', jsonb_build_object(
      'snapshotRef', snapshot_record.snapshot_ref,
      'authorizedNodeIds', snapshot_record.authorized_node_ids,
      'expiresAt', snapshot_record.expires_at
    ),
    'action', jsonb_build_object(
      'state', action_record.state,
      'decisionStatus', action_record.decision_status,
      'authorizationId', action_record.authorization_id,
      'authorizationSnapshotRef', action_record.authorization_snapshot_ref,
      'capabilityId', action_record.capability_id,
      'capabilityVersion', action_record.capability_version,
      'targetNodeIds', action_record.target_node_ids,
      'requestedMode', action_record.requested_mode,
      'closedParameters', action_record.closed_parameters,
      'maxRequests', action_record.max_requests,
      'maxRuntimeMs', action_record.max_runtime_ms,
      'authorizationExpiresAt', action_record.authorization_expires_at
    ),
    'targetNode', jsonb_build_object(
      'nodeId', target_record.node_id,
      'assetType', target_record.asset_type,
      'canonicalLocator', target_record.canonical_locator,
      'authorizationRef', target_record.authorization_ref
    )
  );
end;
$$;

revoke all on function public.get_phase11_http_worker_preparation_context(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_phase11_http_worker_preparation_context(uuid, uuid, uuid, text)
  to service_role;

create or replace function public.get_phase11_http_worker_finalization_context(
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
  lookup_now timestamptz := clock_timestamp();
  calculated_hash text;
  worker_record private.worker_nodes%rowtype;
  task_record private.worker_tasks%rowtype;
  attempt_record private.worker_attempts%rowtype;
  binding_record private.phase11_http_worker_tasks%rowtype;
  run_record private.pentest_runs%rowtype;
  action_record private.pentest_actions%rowtype;
  snapshot_record private.pentest_run_authorization_snapshots%rowtype;
  cancel_requested boolean;
begin
  if target_worker_id is null
    or target_task_id is null
    or target_attempt_id is null
    or target_lease_token is null
    or target_lease_token !~ '^[a-f0-9]{64}$'
  then
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

  select * into binding_record
  from private.phase11_http_worker_tasks
  where task_id = target_task_id;

  if worker_record.id is null
    or worker_record.disabled_at is not null
    or worker_record.execution_class <> 'phase11_http_discovery_v1'
    or task_record.id is null
    or task_record.execution_class <> 'phase11_http_discovery_v1'
    or task_record.workspace_id is distinct from binding_record.workspace_id
    or task_record.scan_job_id is not null
    or task_record.asset_id is not null
    or binding_record.task_id is null
    or attempt_record.id is null
    or attempt_record.worker_id is distinct from target_worker_id
    or attempt_record.lease_token_hash is distinct from calculated_hash
  then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  if attempt_record.finished_at is null
    and (task_record.state <> 'leased' or attempt_record.lease_expires_at <= lookup_now)
  then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  select * into run_record
  from private.pentest_runs
  where id = binding_record.run_id
    and workspace_id = binding_record.workspace_id;

  select * into action_record
  from private.pentest_actions
  where workspace_id = binding_record.workspace_id
    and run_id = binding_record.run_id
    and action_id = binding_record.action_id;

  if run_record.id is null
    or action_record.action_id is null
    or action_record.authorization_id is distinct from binding_record.authorization_id
    or run_record.authorization_snapshot_ref is distinct from binding_record.authorization_snapshot_ref
    or action_record.authorization_snapshot_ref is distinct from binding_record.authorization_snapshot_ref
    or action_record.capability_id is distinct from binding_record.capability_id
    or action_record.capability_version is distinct from binding_record.capability_version
    or cardinality(action_record.target_node_ids) <> 1
    or action_record.target_node_ids[1] is distinct from binding_record.target_node_id
    or action_record.requested_mode <> 'safe_active'
    or action_record.closed_parameters->>'discoveryProfile' not in ('root-only', 'well-known-safe')
  then
    raise exception 'PHASE11_HTTP_WORKER_BINDING_MISMATCH';
  end if;

  cancel_requested := run_record.status = 'cancelled' or action_record.state = 'cancelled';

  if attempt_record.finished_at is null and not cancel_requested then
    select * into snapshot_record
    from private.pentest_run_authorization_snapshots
    where workspace_id = binding_record.workspace_id
      and run_id = binding_record.run_id
      and snapshot_ref = binding_record.authorization_snapshot_ref;

    if run_record.status <> 'running'
      or action_record.state <> 'running'
      or action_record.decision_status not in ('approved', 'narrowed')
      or snapshot_record.snapshot_ref is null
      or snapshot_record.expires_at <= lookup_now
      or action_record.authorization_expires_at is null
      or action_record.authorization_expires_at <= lookup_now
      or action_record.authorization_expires_at > snapshot_record.expires_at
      or not (binding_record.target_node_id = any(snapshot_record.authorized_node_ids))
    then
      raise exception 'PHASE11_HTTP_AUTHORIZATION_EXPIRED';
    end if;
  end if;

  return jsonb_build_object(
    'taskId', task_record.id,
    'attemptId', attempt_record.id,
    'workspaceId', binding_record.workspace_id,
    'runId', binding_record.run_id,
    'actionId', binding_record.action_id,
    'authorizationId', binding_record.authorization_id,
    'authorizationSnapshotRef', binding_record.authorization_snapshot_ref,
    'targetNodeId', binding_record.target_node_id,
    'capabilityId', binding_record.capability_id,
    'providerId', binding_record.provider_id,
    'providerVersion', binding_record.provider_version,
    'discoveryProfile', action_record.closed_parameters->>'discoveryProfile',
    'leasedAt', attempt_record.leased_at,
    'leaseExpiresAt', attempt_record.lease_expires_at,
    'cancelRequested', cancel_requested,
    'finishedAt', attempt_record.finished_at,
    'priorOutcome', attempt_record.outcome,
    'priorTerminalDigest', attempt_record.terminal_payload_digest
  );
end;
$$;

revoke all on function public.get_phase11_http_worker_finalization_context(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_phase11_http_worker_finalization_context(uuid, uuid, uuid, text)
  to service_role;

create or replace function public.finalize_phase11_http_worker_attempt(
  target_worker_id uuid,
  target_task_id uuid,
  target_attempt_id uuid,
  target_lease_token text,
  target_terminal_digest text,
  target_outcome text,
  target_failure_code text,
  target_request_count integer,
  target_metrics jsonb,
  observation_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  finalize_now timestamptz := clock_timestamp();
  calculated_hash text;
  task_record private.worker_tasks%rowtype;
  attempt_record private.worker_attempts%rowtype;
  binding_record private.phase11_http_worker_tasks%rowtype;
  run_record private.pentest_runs%rowtype;
  action_record private.pentest_actions%rowtype;
  snapshot_record private.pentest_run_authorization_snapshots%rowtype;
  observation_row jsonb;
  effective_outcome text;
  attempt_status text;
  observation_ids text[] := '{}';
  evidence_refs text[] := '{}';
begin
  if target_worker_id is null
    or target_task_id is null
    or target_attempt_id is null
    or target_lease_token is null
    or target_lease_token !~ '^[a-f0-9]{64}$'
    or target_terminal_digest is null
    or target_terminal_digest !~ '^[a-f0-9]{64}$'
    or target_outcome not in ('succeeded', 'failed', 'cancelled')
    or target_request_count is null
    or target_request_count < 0
    or target_request_count > 12
    or target_metrics is null
    or jsonb_typeof(target_metrics) <> 'object'
    or (select count(*) from jsonb_object_keys(target_metrics)) <> 5
    or not (target_metrics ?& array[
      'wallTimeMs', 'cpuTimeMs', 'peakMemoryBytes', 'inputBytes', 'outputBytes'
    ])
    or jsonb_typeof(target_metrics->'wallTimeMs') <> 'number'
    or (target_metrics->>'wallTimeMs')::numeric not between 0 and 30000
    or jsonb_typeof(target_metrics->'cpuTimeMs') <> 'number'
    or (target_metrics->>'cpuTimeMs')::numeric not between 0 and 15000
    or jsonb_typeof(target_metrics->'peakMemoryBytes') <> 'number'
    or (target_metrics->>'peakMemoryBytes')::numeric not between 0 and 268435456
    or jsonb_typeof(target_metrics->'inputBytes') <> 'number'
    or (target_metrics->>'inputBytes')::numeric not between 0 and 4096
    or jsonb_typeof(target_metrics->'outputBytes') <> 'number'
    or (target_metrics->>'outputBytes')::numeric not between 0 and 32768
    or observation_rows is null
    or jsonb_typeof(observation_rows) <> 'array'
    or jsonb_array_length(observation_rows) > 4
  then
    raise exception 'PHASE11_HTTP_TERMINAL_INVALID';
  end if;
  if target_outcome = 'failed' and target_failure_code not in (
    'WORKER_LOST', 'WORKER_BUDGET_EXCEEDED', 'WORKER_OUTPUT_INVALID',
    'WORKER_EXECUTION_FAILED', 'WORKER_CLASS_UNAVAILABLE',
    'RUNTIME_WORKER_AUTHORIZATION_FAILED', 'RUNTIME_WORKER_CANCELLED',
    'RUNTIME_WORKER_NETWORK_POLICY_FAILED', 'RUNTIME_WORKER_BUDGET_EXCEEDED',
    'RUNTIME_WORKER_OUTPUT_INVALID', 'RUNTIME_WORKER_EXECUTION_FAILED',
    'HTTP_DISCOVERY_REQUEST_BUDGET', 'HTTP_DISCOVERY_REQUEST_TIMEOUT',
    'HTTP_DISCOVERY_TOTAL_TIMEOUT', 'HTTP_DISCOVERY_NETWORK_ERROR',
    'HTTP_DISCOVERY_PROFILE_INVALID'
  ) then
    raise exception 'PHASE11_HTTP_FAILURE_CODE_INVALID';
  end if;
  if target_outcome <> 'failed' and target_failure_code is not null then
    raise exception 'PHASE11_HTTP_FAILURE_CODE_INVALID';
  end if;
  if target_outcome <> 'succeeded' and jsonb_array_length(observation_rows) <> 0 then
    raise exception 'PHASE11_HTTP_OBSERVATION_OUTCOME_INVALID';
  end if;

  calculated_hash := encode(
    extensions.digest(decode(target_lease_token, 'hex'), 'sha256'),
    'hex'
  );

  select * into task_record
  from private.worker_tasks
  where id = target_task_id
  for update;

  select * into attempt_record
  from private.worker_attempts
  where id = target_attempt_id
    and task_id = target_task_id
  for update;

  select * into binding_record
  from private.phase11_http_worker_tasks
  where task_id = target_task_id;

  if task_record.id is null
    or task_record.execution_class <> 'phase11_http_discovery_v1'
    or task_record.workspace_id is distinct from binding_record.workspace_id
    or binding_record.task_id is null
    or attempt_record.id is null
    or attempt_record.worker_id is distinct from target_worker_id
    or attempt_record.lease_token_hash is distinct from calculated_hash
  then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  if attempt_record.finished_at is not null then
    if attempt_record.terminal_payload_digest is distinct from target_terminal_digest
    then
      raise exception 'WORKER_TERMINAL_CONFLICT';
    end if;
    return jsonb_build_object('outcome', attempt_record.outcome, 'replayed', true);
  end if;

  if task_record.state <> 'leased'
    or task_record.absolute_deadline_at <= finalize_now
    or attempt_record.lease_expires_at <= finalize_now
  then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  select * into run_record
  from private.pentest_runs
  where id = binding_record.run_id
    and workspace_id = binding_record.workspace_id
  for update;

  select * into action_record
  from private.pentest_actions
  where workspace_id = binding_record.workspace_id
    and run_id = binding_record.run_id
    and action_id = binding_record.action_id
  for update;

  if run_record.id is null
    or action_record.action_id is null
    or action_record.authorization_id is distinct from binding_record.authorization_id
    or run_record.authorization_snapshot_ref is distinct from binding_record.authorization_snapshot_ref
    or action_record.authorization_snapshot_ref is distinct from binding_record.authorization_snapshot_ref
    or action_record.capability_id is distinct from binding_record.capability_id
    or action_record.capability_version is distinct from binding_record.capability_version
    or cardinality(action_record.target_node_ids) <> 1
    or action_record.target_node_ids[1] is distinct from binding_record.target_node_id
    or action_record.requested_mode <> 'safe_active'
  then
    raise exception 'PHASE11_HTTP_WORKER_BINDING_MISMATCH';
  end if;

  if run_record.status = 'cancelled' or action_record.state = 'cancelled' then
    effective_outcome := 'cancelled';
  else
    effective_outcome := target_outcome;
    select * into snapshot_record
    from private.pentest_run_authorization_snapshots
    where workspace_id = binding_record.workspace_id
      and run_id = binding_record.run_id
      and snapshot_ref = binding_record.authorization_snapshot_ref;
    if run_record.status <> 'running'
      or action_record.state <> 'running'
      or action_record.decision_status not in ('approved', 'narrowed')
      or snapshot_record.snapshot_ref is null
      or snapshot_record.expires_at <= finalize_now
      or action_record.authorization_expires_at is null
      or action_record.authorization_expires_at <= finalize_now
      or action_record.authorization_expires_at > snapshot_record.expires_at
      or not (binding_record.target_node_id = any(snapshot_record.authorized_node_ids))
    then
      raise exception 'PHASE11_HTTP_AUTHORIZATION_EXPIRED';
    end if;
  end if;

  if effective_outcome <> 'succeeded' then
    observation_rows := '[]'::jsonb;
    target_request_count := 0;
  else
    for observation_row in select value from jsonb_array_elements(observation_rows)
    loop
      if observation_row->>'observation_id' !~ '^phase11-obs-http:[0-9a-f]{64}$'
        or observation_row->>'provider_id' <> binding_record.provider_id
        or observation_row->>'provider_version' <> binding_record.provider_version
        or observation_row->>'capability_id' <> binding_record.capability_id
        or observation_row->>'authorization_snapshot_ref' <> binding_record.authorization_snapshot_ref
        or observation_row->>'execution_mode' <> 'safe_active'
        or observation_row->'asset_node_ids' <> jsonb_build_array(binding_record.target_node_id)
        or jsonb_array_length(observation_row->'evidence_refs') <> 1
        or observation_row->'evidence_refs'->>0 !~
          ('^phase11-http-attempt:' || target_attempt_id::text || ':(root|security-txt|robots|sitemap)$')
      then
        raise exception 'PHASE11_HTTP_OBSERVATION_INVALID';
      end if;
      observation_ids := array_append(observation_ids, observation_row->>'observation_id');
      evidence_refs := array_append(evidence_refs, observation_row->'evidence_refs'->>0);
    end loop;

    perform public.persist_phase11_observations(
      binding_record.workspace_id,
      binding_record.run_id,
      binding_record.authorization_snapshot_ref,
      observation_rows
    );
  end if;

  attempt_status := case effective_outcome
    when 'succeeded' then case when cardinality(observation_ids) = 0 then 'no_signal' else 'succeeded' end
    when 'cancelled' then 'cancelled'
    else 'provider_failed'
  end;

  insert into private.pentest_action_attempts (
    id, workspace_id, run_id, action_id, authorization_id,
    provider_id, provider_version, status, observation_ids, evidence_refs,
    started_at, completed_at, error_code
  ) values (
    attempt_record.id, binding_record.workspace_id, binding_record.run_id,
    binding_record.action_id, binding_record.authorization_id,
    binding_record.provider_id, binding_record.provider_version, attempt_status,
    observation_ids, evidence_refs, attempt_record.leased_at, finalize_now,
    case when effective_outcome = 'failed' then target_failure_code else null end
  );

  update private.worker_attempts
  set finished_at = finalize_now,
      outcome = effective_outcome,
      failure_code = case when effective_outcome = 'failed' then target_failure_code else null end,
      terminal_payload_digest = target_terminal_digest,
      wall_time_ms = (target_metrics->>'wallTimeMs')::integer,
      cpu_time_ms = (target_metrics->>'cpuTimeMs')::integer,
      peak_memory_bytes = (target_metrics->>'peakMemoryBytes')::bigint,
      input_bytes = (target_metrics->>'inputBytes')::bigint,
      output_bytes = (target_metrics->>'outputBytes')::bigint
  where id = attempt_record.id;

  update private.worker_tasks
  set state = case effective_outcome when 'succeeded' then 'completed' when 'cancelled' then 'cancelled' else 'dead_letter' end,
      updated_at = finalize_now
  where id = task_record.id;

  update private.pentest_actions
  set state = case when effective_outcome = 'cancelled' then 'cancelled' else 'terminal' end,
      updated_at = finalize_now
  where workspace_id = binding_record.workspace_id
    and run_id = binding_record.run_id
    and action_id = binding_record.action_id;

  update public.pentest_action_summaries
  set state = case when effective_outcome = 'cancelled' then 'cancelled' else 'terminal' end,
      updated_at = finalize_now
  where workspace_id = binding_record.workspace_id
    and run_id = binding_record.run_id
    and action_id = binding_record.action_id;

  perform private.record_worker_event(
    'worker.task_terminal',
    binding_record.workspace_id,
    target_worker_id,
    task_record.id,
    jsonb_build_object(
      'attemptId', attempt_record.id,
      'outcome', effective_outcome,
      'executionClass', task_record.execution_class,
      'requestCount', target_request_count,
      'observationCount', cardinality(observation_ids)
    )
  );

  return jsonb_build_object('outcome', effective_outcome, 'replayed', false);
end;
$$;

revoke all on function public.finalize_phase11_http_worker_attempt(
  uuid, uuid, uuid, text, text, text, text, integer, jsonb, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.finalize_phase11_http_worker_attempt(
  uuid, uuid, uuid, text, text, text, text, integer, jsonb, jsonb
) to service_role;


-- Phase 11 HTTP tasks intentionally have no scan_job row. Replace the shared
-- heartbeat with a class-aware implementation so legacy workers preserve their
-- existing scan-job cancellation semantics while Phase 11 cancellation and
-- authorization expiry are derived only from trusted Phase 11 state.
create or replace function public.heartbeat_worker_attempt(
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
  job_record public.scan_jobs%rowtype;
  phase11_binding private.phase11_http_worker_tasks%rowtype;
  phase11_run private.pentest_runs%rowtype;
  phase11_action private.pentest_actions%rowtype;
  phase11_snapshot private.pentest_run_authorization_snapshots%rowtype;
  heartbeat_now timestamptz;
  calculated_hash text;
  next_expiry timestamptz;
  cancellation_requested boolean;
begin
  if target_lease_token is null or target_lease_token !~ '^[a-f0-9]{64}$' then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  calculated_hash := encode(
    extensions.digest(decode(target_lease_token, 'hex'), 'sha256'),
    'hex'
  );

  perform pg_advisory_xact_lock(hashtextextended('scopeforge-worker-recovery-v1', 0));

  select * into worker_record
  from private.worker_nodes
  where id = target_worker_id
  for update;

  if worker_record.id is null or worker_record.disabled_at is not null then
    raise exception 'WORKER_DISABLED';
  end if;

  select * into task_record
  from private.worker_tasks
  where id = target_task_id
  for update;

  select * into attempt_record
  from private.worker_attempts
  where id = target_attempt_id
    and task_id = target_task_id
  for update;

  heartbeat_now := clock_timestamp();

  if task_record.id is null
    or attempt_record.id is null
    or attempt_record.worker_id <> target_worker_id
    or attempt_record.lease_token_hash <> calculated_hash
    or attempt_record.finished_at is not null
    or task_record.state <> 'leased'
    or attempt_record.lease_expires_at <= heartbeat_now
  then
    raise exception 'WORKER_LEASE_INVALID';
  end if;

  if task_record.execution_class = 'phase11_http_discovery_v1' then
    if worker_record.execution_class <> 'phase11_http_discovery_v1'
      or task_record.scan_job_id is not null
      or task_record.asset_id is not null
    then
      raise exception 'WORKER_LEASE_INVALID';
    end if;

    select * into phase11_binding
    from private.phase11_http_worker_tasks
    where task_id = task_record.id;

    if phase11_binding.task_id is null
      or task_record.workspace_id is distinct from phase11_binding.workspace_id
    then
      raise exception 'WORKER_LEASE_INVALID';
    end if;

    select * into phase11_run
    from private.pentest_runs
    where id = phase11_binding.run_id
      and workspace_id = phase11_binding.workspace_id;

    select * into phase11_action
    from private.pentest_actions
    where workspace_id = phase11_binding.workspace_id
      and run_id = phase11_binding.run_id
      and action_id = phase11_binding.action_id;

    select * into phase11_snapshot
    from private.pentest_run_authorization_snapshots
    where workspace_id = phase11_binding.workspace_id
      and run_id = phase11_binding.run_id
      and snapshot_ref = phase11_binding.authorization_snapshot_ref;

    if phase11_run.id is null
      or phase11_action.action_id is null
      or phase11_snapshot.snapshot_ref is null
      or phase11_action.authorization_id is distinct from phase11_binding.authorization_id
      or phase11_action.authorization_snapshot_ref is distinct from phase11_binding.authorization_snapshot_ref
      or phase11_run.authorization_snapshot_ref is distinct from phase11_binding.authorization_snapshot_ref
    then
      raise exception 'PHASE11_HTTP_WORKER_BINDING_MISMATCH';
    end if;

    cancellation_requested :=
      phase11_run.status <> 'running'
      or phase11_action.state <> 'running'
      or phase11_snapshot.expires_at <= heartbeat_now
      or phase11_action.authorization_expires_at is null
      or phase11_action.authorization_expires_at <= heartbeat_now
      or phase11_action.authorization_expires_at > phase11_snapshot.expires_at;

    if cancellation_requested then
      next_expiry := attempt_record.lease_expires_at;
    else
      next_expiry := least(
        heartbeat_now + interval '90 seconds',
        task_record.absolute_deadline_at,
        phase11_snapshot.expires_at,
        phase11_action.authorization_expires_at
      );
    end if;
  else
    select * into job_record
    from public.scan_jobs
    where id = task_record.scan_job_id
      and workspace_id = task_record.workspace_id
      and asset_id = task_record.asset_id
    for update;

    if job_record.id is null then
      raise exception 'WORKER_JOB_NOT_AVAILABLE';
    end if;

    cancellation_requested := job_record.cancel_requested_at is not null
      or job_record.status = 'cancelled'::public.scan_job_status;

    if cancellation_requested then
      next_expiry := attempt_record.lease_expires_at;
    else
      next_expiry := least(
        heartbeat_now + interval '90 seconds',
        task_record.absolute_deadline_at
      );
    end if;
  end if;

  update private.worker_attempts
  set last_heartbeat_at = heartbeat_now,
      lease_expires_at = next_expiry
  where id = attempt_record.id
  returning * into attempt_record;

  update private.worker_nodes
  set last_seen_at = heartbeat_now
  where id = worker_record.id;

  return jsonb_build_object(
    'cancelRequested', cancellation_requested,
    'leaseExpiresAt', attempt_record.lease_expires_at
  );
end;
$$;

revoke all on function public.heartbeat_worker_attempt(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.heartbeat_worker_attempt(uuid, uuid, uuid, text)
  to service_role;


create or replace function public.cancel_phase11_http_worker_task(
  target_workspace_id uuid,
  target_run_id uuid,
  target_action_id text,
  target_task_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cancel_now timestamptz := clock_timestamp();
  task_record private.worker_tasks%rowtype;
  binding_record private.phase11_http_worker_tasks%rowtype;
  action_record private.pentest_actions%rowtype;
  was_replayed boolean := false;
begin
  if target_workspace_id is null
    or target_run_id is null
    or target_action_id is null
    or target_action_id !~ '^phase11-action:[0-9a-f]{64}$'
    or target_task_id is null
  then
    raise exception 'PHASE11_HTTP_QUEUE_IDENTITY_INVALID';
  end if;

  select *
  into task_record
  from private.worker_tasks
  where id = target_task_id
  for update;

  select *
  into binding_record
  from private.phase11_http_worker_tasks
  where task_id = target_task_id;

  select *
  into action_record
  from private.pentest_actions
  where workspace_id = target_workspace_id
    and run_id = target_run_id
    and action_id = target_action_id
  for update;

  if task_record.id is null
    or binding_record.task_id is null
    or action_record.action_id is null
    or task_record.execution_class <> 'phase11_http_discovery_v1'
    or task_record.workspace_id is distinct from target_workspace_id
    or binding_record.workspace_id is distinct from target_workspace_id
    or binding_record.run_id is distinct from target_run_id
    or binding_record.action_id is distinct from target_action_id
    or action_record.authorization_id is distinct from binding_record.authorization_id
    or action_record.queue_reference is distinct from
      'phase11-http-worker:' || target_task_id::text
  then
    raise exception 'PHASE11_HTTP_WORKER_BINDING_MISMATCH';
  end if;

  if task_record.state = 'cancelled' then
    was_replayed := true;
  elsif task_record.state in ('queued', 'retry_wait') then
    update private.worker_tasks
    set state = 'cancelled',
        updated_at = cancel_now
    where id = target_task_id
      and state in ('queued', 'retry_wait');
  elsif task_record.state = 'leased' then
    -- Keep the live lease intact. The authorization-aware heartbeat observes
    -- the action cancellation and the worker finalizes through the normal
    -- authenticated Phase 11 finalization path.
    null;
  else
    return jsonb_build_object(
      'cancelled', false,
      'replayed', true
    );
  end if;

  if action_record.state not in ('terminal', 'rejected', 'cancelled') then
    update private.pentest_actions
    set state = 'cancelled',
        enqueue_token = null,
        updated_at = cancel_now
    where workspace_id = target_workspace_id
      and run_id = target_run_id
      and action_id = target_action_id;
  elsif action_record.state = 'cancelled' then
    was_replayed := true;
  else
    raise exception 'PHASE11_HTTP_ACTION_STATE_INVALID';
  end if;

  update public.pentest_action_summaries
  set state = 'cancelled',
      updated_at = cancel_now
  where workspace_id = target_workspace_id
    and run_id = target_run_id
    and action_id = target_action_id
    and state <> 'cancelled';

  perform private.record_worker_event(
    'worker.cancel_requested',
    target_workspace_id,
    null,
    target_task_id,
    jsonb_build_object(
      'runId', target_run_id,
      'actionId', target_action_id,
      'executionClass', 'phase11_http_discovery_v1'
    )
  );

  return jsonb_build_object(
    'cancelled', true,
    'replayed', was_replayed
  );
end;
$$;

revoke all on function public.cancel_phase11_http_worker_task(uuid, uuid, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.cancel_phase11_http_worker_task(uuid, uuid, text, uuid)
  to service_role;
