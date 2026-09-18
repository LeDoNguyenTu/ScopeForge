-- Phase 11C: source-only HTTP discovery worker queue/control persistence.
-- Forward-only. Committing this migration does not authorize production application
-- or hosted execution of the phase11_http_discovery_v1 class.

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
