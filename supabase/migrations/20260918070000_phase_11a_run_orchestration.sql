-- Phase 11A trusted run orchestration.
-- Forward-only. Depends on 20260918061500_phase_11a_planning_graph.sql.
-- Committing this migration does not authorize production application or provider execution.

create table private.pentest_run_authorization_snapshots (
  workspace_id uuid not null,
  run_id uuid not null,
  snapshot_ref text not null,
  authorized_node_ids text[] not null,
  max_execution_mode text not null
    check (max_execution_mode in ('passive', 'safe_active', 'intrusive', 'validation')),
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (workspace_id, run_id, snapshot_ref),
  constraint pentest_run_authorization_snapshots_run_fkey
    foreign key (run_id, workspace_id)
    references private.pentest_runs(id, workspace_id)
    on delete cascade,
  check (char_length(snapshot_ref) between 1 and 512),
  check (cardinality(authorized_node_ids) between 1 and 1024),
  check (array_position(authorized_node_ids, '') is null)
);

create index pentest_run_authorization_snapshots_expiry_idx
  on private.pentest_run_authorization_snapshots(run_id, workspace_id, expires_at desc);

create table private.pentest_actions (
  workspace_id uuid not null,
  run_id uuid not null,
  action_id text not null,
  hypothesis_id text not null,
  capability_id text not null,
  target_node_ids text[] not null,
  requested_mode text not null
    check (requested_mode in ('passive', 'safe_active', 'intrusive', 'validation')),
  closed_parameters jsonb not null default '{}'::jsonb,
  expected_evidence_types text[] not null,
  authorization_snapshot_ref text not null,
  decision_status text not null
    check (decision_status in ('approved', 'narrowed', 'approval_required', 'rejected')),
  decision_reasons text[] not null default '{}',
  authorization_id text,
  max_requests integer,
  max_runtime_ms integer,
  authorization_expires_at timestamptz,
  cancellation_key text,
  state text not null
    check (state in (
      'approval_required', 'rejected', 'authorized', 'enqueueing',
      'queued', 'running', 'terminal', 'cancelled'
    )),
  enqueue_token uuid,
  queue_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, run_id, action_id),
  constraint pentest_actions_run_fkey
    foreign key (run_id, workspace_id)
    references private.pentest_runs(id, workspace_id)
    on delete cascade,
  constraint pentest_actions_hypothesis_fkey
    foreign key (workspace_id, run_id, hypothesis_id)
    references private.pentest_hypotheses(workspace_id, run_id, hypothesis_id)
    on delete cascade,
  check (char_length(action_id) between 1 and 1536),
  check (char_length(hypothesis_id) between 1 and 1024),
  check (char_length(capability_id) between 1 and 256),
  check (cardinality(target_node_ids) between 1 and 256),
  check (array_position(target_node_ids, '') is null),
  check (jsonb_typeof(closed_parameters) = 'object'),
  check (octet_length(closed_parameters::text) <= 8192),
  check (cardinality(expected_evidence_types) between 1 and 256),
  check (char_length(authorization_snapshot_ref) between 1 and 512),
  check (cardinality(decision_reasons) <= 64),
  check (authorization_id is null or char_length(authorization_id) between 1 and 2048),
  check (max_requests is null or max_requests > 0),
  check (max_runtime_ms is null or max_runtime_ms > 0),
  check (cancellation_key is null or char_length(cancellation_key) between 1 and 1024),
  check (queue_reference is null or char_length(queue_reference) between 1 and 1024),
  check (
    (decision_status in ('approved', 'narrowed')
      and authorization_id is not null
      and max_requests is not null
      and max_runtime_ms is not null
      and authorization_expires_at is not null
      and cancellation_key is not null)
    or
    (decision_status in ('approval_required', 'rejected')
      and authorization_id is null
      and max_requests is null
      and max_runtime_ms is null
      and authorization_expires_at is null
      and cancellation_key is null)
  )
);

create index pentest_actions_run_state_idx
  on private.pentest_actions(run_id, workspace_id, state, updated_at desc);
create index pentest_actions_hypothesis_idx
  on private.pentest_actions(workspace_id, run_id, hypothesis_id);

create table private.pentest_action_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  run_id uuid not null,
  action_id text not null,
  authorization_id text not null,
  provider_id text not null,
  provider_version text not null,
  status text not null
    check (status in (
      'succeeded', 'no_signal', 'blocked', 'cancelled', 'timed_out',
      'provider_failed', 'policy_rejected'
    )),
  observation_ids text[] not null default '{}',
  evidence_refs text[] not null default '{}',
  started_at timestamptz not null,
  completed_at timestamptz not null,
  error_code text,
  created_at timestamptz not null default now(),
  constraint pentest_action_attempts_action_fkey
    foreign key (workspace_id, run_id, action_id)
    references private.pentest_actions(workspace_id, run_id, action_id)
    on delete cascade,
  check (char_length(authorization_id) between 1 and 2048),
  check (char_length(provider_id) between 1 and 256),
  check (char_length(provider_version) between 1 and 256),
  check (cardinality(observation_ids) <= 256),
  check (cardinality(evidence_refs) <= 256),
  check (completed_at >= started_at),
  check (error_code is null or char_length(error_code) between 1 and 128)
);

create index pentest_action_attempts_action_idx
  on private.pentest_action_attempts(workspace_id, run_id, action_id, created_at desc);

create table private.pentest_approval_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  run_id uuid not null,
  action_id text not null,
  mode text not null check (mode in ('intrusive', 'validation')),
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_by_role text not null check (approved_by_role in ('owner', 'admin')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint pentest_approval_events_action_fkey
    foreign key (workspace_id, run_id, action_id)
    references private.pentest_actions(workspace_id, run_id, action_id)
    on delete cascade
);

create index pentest_approval_events_action_idx
  on private.pentest_approval_events(workspace_id, run_id, action_id, created_at desc);

alter table private.pentest_run_authorization_snapshots enable row level security;
alter table private.pentest_actions enable row level security;
alter table private.pentest_action_attempts enable row level security;
alter table private.pentest_approval_events enable row level security;

revoke all on table private.pentest_run_authorization_snapshots from public, anon, authenticated, service_role;
revoke all on table private.pentest_actions from public, anon, authenticated, service_role;
revoke all on table private.pentest_action_attempts from public, anon, authenticated, service_role;
revoke all on table private.pentest_approval_events from public, anon, authenticated, service_role;

create table public.pentest_action_summaries (
  workspace_id uuid not null,
  run_id uuid not null,
  action_id text not null,
  hypothesis_id text not null,
  capability_id text not null,
  target_node_ids text[] not null,
  requested_mode text not null,
  state text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (workspace_id, run_id, action_id),
  constraint pentest_action_summaries_run_fkey
    foreign key (run_id, workspace_id)
    references public.pentest_run_summaries(run_id, workspace_id)
    on delete cascade
);

create index pentest_action_summaries_run_state_idx
  on public.pentest_action_summaries(run_id, workspace_id, state, updated_at desc);

alter table public.pentest_action_summaries enable row level security;

create policy pentest_action_summaries_select_member
  on public.pentest_action_summaries for select
  to authenticated
  using ((select private.is_workspace_member(workspace_id)));

revoke all on table public.pentest_action_summaries from public, anon, authenticated, service_role;
grant select on table public.pentest_action_summaries to authenticated;

create or replace function private.assert_phase11_run_scope(
  target_workspace_id uuid,
  target_run_id uuid,
  target_authorization_snapshot_ref text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_record private.pentest_runs%rowtype;
begin
  select *
  into run_record
  from private.pentest_runs
  where id = target_run_id
    and workspace_id = target_workspace_id;

  if not found then
    raise exception 'PHASE11_RUN_NOT_FOUND';
  end if;

  if run_record.authorization_snapshot_ref is distinct from target_authorization_snapshot_ref then
    raise exception 'PHASE11_AUTHORIZATION_SNAPSHOT_MISMATCH';
  end if;

  if not exists (
    select 1
    from private.pentest_run_authorization_snapshots snapshot
    where snapshot.workspace_id = target_workspace_id
      and snapshot.run_id = target_run_id
      and snapshot.snapshot_ref = target_authorization_snapshot_ref
  ) then
    raise exception 'PHASE11_AUTHORIZATION_SNAPSHOT_NOT_FOUND';
  end if;
end;
$$;

revoke all on function private.assert_phase11_run_scope(uuid, uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.assert_phase11_active_authorization(
  target_workspace_id uuid,
  target_run_id uuid,
  target_authorization_snapshot_ref text
)
returns private.pentest_run_authorization_snapshots
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_record private.pentest_runs%rowtype;
  snapshot_record private.pentest_run_authorization_snapshots%rowtype;
begin
  perform private.assert_phase11_run_scope(
    target_workspace_id,
    target_run_id,
    target_authorization_snapshot_ref
  );

  select *
  into run_record
  from private.pentest_runs
  where id = target_run_id
    and workspace_id = target_workspace_id
  for update;

  if run_record.status in ('completed', 'cancelled', 'failed') then
    raise exception 'PHASE11_RUN_TERMINAL';
  end if;

  select *
  into snapshot_record
  from private.pentest_run_authorization_snapshots
  where workspace_id = target_workspace_id
    and run_id = target_run_id
    and snapshot_ref = target_authorization_snapshot_ref;

  if snapshot_record.expires_at <= now() then
    raise exception 'PHASE11_AUTHORIZATION_EXPIRED';
  end if;

  return snapshot_record;
end;
$$;

revoke all on function private.assert_phase11_active_authorization(uuid, uuid, text)
  from public, anon, authenticated, service_role;

create or replace function public.create_phase11_pentest_run(
  target_run_id uuid,
  target_workspace_id uuid,
  target_asset_id uuid,
  target_actor_id uuid,
  target_authorization_snapshot_ref text,
  target_root_node_id text,
  target_authorized_node_ids text[],
  target_max_execution_mode text,
  target_authorization_expires_at timestamptz,
  target_policy_snapshot jsonb,
  target_deadline_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role public.workspace_role;
  asset_record public.assets%rowtype;
  existing_run private.pentest_runs%rowtype;
  run_now timestamptz := now();
  root_asset_type text;
  provenance_ref text;
begin
  if target_run_id is null
    or target_workspace_id is null
    or target_asset_id is null
    or target_actor_id is null
    or target_authorization_snapshot_ref is null
    or char_length(target_authorization_snapshot_ref) not between 1 and 512
    or target_root_node_id is null
    or char_length(target_root_node_id) not between 1 and 512
    or target_authorized_node_ids is null
    or cardinality(target_authorized_node_ids) not between 1 and 1024
    or array_position(target_authorized_node_ids, '') is not null
    or not (target_root_node_id = any(target_authorized_node_ids))
    or target_max_execution_mode not in ('passive', 'safe_active', 'intrusive', 'validation')
    or target_authorization_expires_at is null
    or target_authorization_expires_at <= run_now
    or target_deadline_at is null
    or target_deadline_at <= run_now
    or target_deadline_at > target_authorization_expires_at
    or target_policy_snapshot is null
    or jsonb_typeof(target_policy_snapshot) <> 'object'
    or octet_length(target_policy_snapshot::text) > 65536
  then
    raise exception 'PHASE11_RUN_INPUT_INVALID';
  end if;

  select role
  into actor_role
  from public.workspace_members
  where workspace_id = target_workspace_id
    and user_id = target_actor_id;

  if actor_role is null or actor_role not in ('owner', 'admin') then
    raise exception 'PHASE11_RUN_FORBIDDEN';
  end if;

  select *
  into asset_record
  from public.assets
  where id = target_asset_id
    and workspace_id = target_workspace_id;

  if not found or asset_record.verification_status <> 'verified' or asset_record.verified_at is null then
    raise exception 'PHASE11_RUN_ASSET_NOT_AUTHORIZED';
  end if;

  select *
  into existing_run
  from private.pentest_runs
  where id = target_run_id
  for update;

  if found then
    if existing_run.workspace_id is distinct from target_workspace_id
      or existing_run.root_asset_id is distinct from target_asset_id
      or existing_run.authorization_snapshot_ref is distinct from target_authorization_snapshot_ref
      or existing_run.policy_snapshot is distinct from target_policy_snapshot
    then
      raise exception 'PHASE11_RUN_IDENTITY_CONFLICT';
    end if;

    return jsonb_build_object(
      'runId', existing_run.id,
      'authorizationSnapshotRef', existing_run.authorization_snapshot_ref,
      'replayed', true
    );
  end if;

  root_asset_type := case asset_record.kind::text
    when 'repository' then 'repository'
    when 'api' then 'api'
    when 'web_application' then 'http_service'
    else null
  end;

  if root_asset_type is null then
    raise exception 'PHASE11_RUN_ASSET_KIND_UNSUPPORTED';
  end if;

  provenance_ref := format(
    'asset:%s:verified:%s',
    asset_record.id::text,
    asset_record.verified_at::text
  );

  insert into private.pentest_runs (
    id,
    workspace_id,
    root_asset_id,
    authorization_snapshot_ref,
    policy_snapshot,
    status,
    created_at,
    updated_at
  )
  values (
    target_run_id,
    target_workspace_id,
    target_asset_id,
    target_authorization_snapshot_ref,
    target_policy_snapshot,
    'created',
    run_now,
    run_now
  );

  insert into private.pentest_run_authorization_snapshots (
    workspace_id,
    run_id,
    snapshot_ref,
    authorized_node_ids,
    max_execution_mode,
    expires_at,
    created_by,
    created_at
  )
  values (
    target_workspace_id,
    target_run_id,
    target_authorization_snapshot_ref,
    target_authorized_node_ids,
    target_max_execution_mode,
    target_authorization_expires_at,
    target_actor_id,
    run_now
  );

  insert into public.pentest_run_summaries (
    run_id,
    workspace_id,
    root_asset_id,
    status,
    stop_reason,
    created_at,
    updated_at
  )
  values (
    target_run_id,
    target_workspace_id,
    target_asset_id,
    'created',
    null,
    run_now,
    run_now
  );

  insert into private.pentest_graph_nodes (
    workspace_id,
    run_id,
    node_id,
    asset_type,
    canonical_locator,
    parent_node_ids,
    authorization_ref,
    technology_tags,
    confidence,
    provenance_refs,
    updated_at
  )
  values (
    target_workspace_id,
    target_run_id,
    target_root_node_id,
    root_asset_type,
    asset_record.canonical_target,
    '{}',
    target_authorization_snapshot_ref,
    '{}',
    1,
    array[provenance_ref],
    run_now
  );

  insert into public.pentest_graph_node_summaries (
    workspace_id,
    run_id,
    node_id,
    asset_type,
    parent_node_ids,
    technology_tags,
    confidence,
    updated_at
  )
  values (
    target_workspace_id,
    target_run_id,
    target_root_node_id,
    root_asset_type,
    '{}',
    '{}',
    1,
    run_now
  );

  insert into private.pentest_coverage (
    workspace_id,
    run_id,
    attempted_capability_ids,
    covered_node_ids,
    untested_node_ids,
    request_count,
    graph_expansion_count,
    provider_failure_count,
    started_at,
    deadline_at,
    updated_at
  )
  values (
    target_workspace_id,
    target_run_id,
    '{}',
    '{}',
    array[target_root_node_id],
    0,
    0,
    0,
    run_now,
    target_deadline_at,
    run_now
  );

  insert into public.pentest_coverage_summaries (
    workspace_id,
    run_id,
    attempted_capability_count,
    covered_node_count,
    untested_node_count,
    request_count,
    graph_expansion_count,
    provider_failure_count,
    started_at,
    deadline_at,
    updated_at
  )
  values (
    target_workspace_id,
    target_run_id,
    0,
    0,
    1,
    0,
    0,
    0,
    run_now,
    target_deadline_at,
    run_now
  );

  return jsonb_build_object(
    'runId', target_run_id,
    'authorizationSnapshotRef', target_authorization_snapshot_ref,
    'replayed', false
  );
end;
$$;

create or replace function public.load_phase11_pentest_run_state(
  target_workspace_id uuid,
  target_run_id uuid,
  target_authorization_snapshot_ref text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_record private.pentest_runs%rowtype;
  snapshot_record private.pentest_run_authorization_snapshots%rowtype;
  coverage_record private.pentest_coverage%rowtype;
begin
  perform private.assert_phase11_run_scope(
    target_workspace_id,
    target_run_id,
    target_authorization_snapshot_ref
  );

  select * into run_record
  from private.pentest_runs
  where id = target_run_id and workspace_id = target_workspace_id;

  select * into snapshot_record
  from private.pentest_run_authorization_snapshots
  where workspace_id = target_workspace_id
    and run_id = target_run_id
    and snapshot_ref = target_authorization_snapshot_ref;

  select * into coverage_record
  from private.pentest_coverage
  where workspace_id = target_workspace_id and run_id = target_run_id;

  return jsonb_build_object(
    'run', jsonb_build_object(
      'runId', run_record.id,
      'workspaceId', run_record.workspace_id,
      'rootAssetId', run_record.root_asset_id,
      'authorizationSnapshotRef', run_record.authorization_snapshot_ref,
      'policySnapshot', run_record.policy_snapshot,
      'status', run_record.status,
      'stopReason', run_record.stop_reason
    ),
    'snapshot', jsonb_build_object(
      'snapshotRef', snapshot_record.snapshot_ref,
      'workspaceId', snapshot_record.workspace_id,
      'authorizedNodeIds', to_jsonb(snapshot_record.authorized_node_ids),
      'maxExecutionMode', snapshot_record.max_execution_mode,
      'expiresAt', snapshot_record.expires_at
    ),
    'graph', jsonb_build_object(
      'nodes', coalesce((
        select jsonb_agg(jsonb_build_object(
          'assetNodeId', node.node_id,
          'assetType', node.asset_type,
          'canonicalLocator', node.canonical_locator,
          'parentNodeIds', to_jsonb(node.parent_node_ids),
          'authorizationRef', node.authorization_ref,
          'technologyTags', to_jsonb(node.technology_tags),
          'confidence', node.confidence,
          'provenanceRefs', to_jsonb(node.provenance_refs)
        ) order by node.node_id)
        from private.pentest_graph_nodes node
        where node.workspace_id = target_workspace_id and node.run_id = target_run_id
      ), '[]'::jsonb),
      'edges', coalesce((
        select jsonb_agg(jsonb_build_object(
          'edgeId', edge.edge_id,
          'fromNodeId', edge.from_node_id,
          'toNodeId', edge.to_node_id,
          'relationship', edge.relationship,
          'provenanceKind', edge.provenance_kind,
          'provenanceRefs', to_jsonb(edge.provenance_refs),
          'confidence', edge.confidence,
          'observedAt', edge.observed_at,
          'authorizationRef', edge.authorization_ref,
          'stale', edge.stale
        ) order by edge.edge_id)
        from private.pentest_graph_edges edge
        where edge.workspace_id = target_workspace_id and edge.run_id = target_run_id
      ), '[]'::jsonb)
    ),
    'observations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'observationId', observation.observation_id,
        'runId', observation.run_id,
        'providerId', observation.provider_id,
        'providerVersion', observation.provider_version,
        'capabilityId', observation.capability_id,
        'assetNodeIds', to_jsonb(observation.asset_node_ids),
        'evidenceRefs', to_jsonb(observation.evidence_refs),
        'facts', observation.facts,
        'observedAt', observation.observed_at,
        'confidence', observation.confidence,
        'authorizationSnapshotRef', observation.authorization_snapshot_ref,
        'executionMode', observation.execution_mode
      ) order by observation.observed_at, observation.observation_id)
      from private.pentest_observations observation
      where observation.workspace_id = target_workspace_id and observation.run_id = target_run_id
    ), '[]'::jsonb),
    'hypotheses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'hypothesisId', hypothesis.hypothesis_id,
        'reasoningSource', hypothesis.reasoning_source,
        'targetNodeIds', to_jsonb(hypothesis.target_node_ids),
        'statement', hypothesis.statement,
        'preconditions', to_jsonb(hypothesis.preconditions),
        'candidateCapabilityIds', to_jsonb(hypothesis.candidate_capability_ids),
        'expectedEvidenceTypes', to_jsonb(hypothesis.expected_evidence_types),
        'baseConfidence', hypothesis.base_confidence,
        'confidence', hypothesis.confidence,
        'status', hypothesis.status,
        'evidenceRefs', to_jsonb(hypothesis.evidence_refs)
      ) order by hypothesis.hypothesis_id)
      from private.pentest_hypotheses hypothesis
      where hypothesis.workspace_id = target_workspace_id and hypothesis.run_id = target_run_id
    ), '[]'::jsonb),
    'coverage', jsonb_build_object(
      'attemptedCapabilityIds', to_jsonb(coverage_record.attempted_capability_ids),
      'coveredNodeIds', to_jsonb(coverage_record.covered_node_ids),
      'untestedNodeIds', to_jsonb(coverage_record.untested_node_ids),
      'requestCount', coverage_record.request_count,
      'graphExpansionCount', coverage_record.graph_expansion_count,
      'providerFailureCount', coverage_record.provider_failure_count,
      'startedAt', coverage_record.started_at,
      'deadlineAt', coverage_record.deadline_at
    ),
    'approvals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'actionId', approval.action_id,
        'mode', approval.mode,
        'approvedByRole', approval.approved_by_role,
        'expiresAt', approval.expires_at
      ) order by approval.created_at desc)
      from private.pentest_approval_events approval
      where approval.workspace_id = target_workspace_id
        and approval.run_id = target_run_id
        and approval.expires_at > now()
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.record_phase11_action_decision(
  target_workspace_id uuid,
  target_run_id uuid,
  target_authorization_snapshot_ref text,
  target_action_id text,
  target_hypothesis_id text,
  target_capability_id text,
  target_node_ids text[],
  target_requested_mode text,
  target_closed_parameters jsonb,
  target_expected_evidence_types text[],
  target_decision_status text,
  target_decision_reasons text[],
  target_authorization_id text,
  target_max_requests integer,
  target_max_runtime_ms integer,
  target_authorization_expires_at timestamptz,
  target_cancellation_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot_record private.pentest_run_authorization_snapshots%rowtype;
  hypothesis_record private.pentest_hypotheses%rowtype;
  existing_action private.pentest_actions%rowtype;
  new_state text;
  reservation_token uuid;
  target_count integer;
  matched_count integer;
begin
  snapshot_record := private.assert_phase11_active_authorization(
    target_workspace_id,
    target_run_id,
    target_authorization_snapshot_ref
  );

  if target_action_id is null
    or char_length(target_action_id) not between 1 and 1536
    or target_hypothesis_id is null
    or char_length(target_hypothesis_id) not between 1 and 1024
    or target_capability_id is null
    or char_length(target_capability_id) not between 1 and 256
    or target_node_ids is null
    or cardinality(target_node_ids) not between 1 and 256
    or array_position(target_node_ids, '') is not null
    or target_requested_mode not in ('passive', 'safe_active', 'intrusive', 'validation')
    or target_closed_parameters is null
    or jsonb_typeof(target_closed_parameters) <> 'object'
    or octet_length(target_closed_parameters::text) > 8192
    or exists (
      select 1 from jsonb_each(target_closed_parameters) parameter
      where jsonb_typeof(parameter.value) not in ('string', 'number', 'boolean')
    )
    or target_expected_evidence_types is null
    or cardinality(target_expected_evidence_types) not between 1 and 256
    or target_decision_status not in ('approved', 'narrowed', 'approval_required', 'rejected')
    or cardinality(coalesce(target_decision_reasons, '{}')) > 64
  then
    raise exception 'PHASE11_ACTION_DECISION_INVALID';
  end if;

  if target_decision_status in ('approved', 'narrowed') then
    if target_authorization_id is null
      or char_length(target_authorization_id) not between 1 and 2048
      or target_max_requests is null or target_max_requests <= 0
      or target_max_runtime_ms is null or target_max_runtime_ms <= 0
      or target_authorization_expires_at is null
      or target_authorization_expires_at <= now()
      or target_authorization_expires_at > snapshot_record.expires_at
      or target_cancellation_key is null
      or char_length(target_cancellation_key) not between 1 and 1024
    then
      raise exception 'PHASE11_ACTION_AUTHORIZATION_INVALID';
    end if;
  elsif target_authorization_id is not null
    or target_max_requests is not null
    or target_max_runtime_ms is not null
    or target_authorization_expires_at is not null
    or target_cancellation_key is not null
  then
    raise exception 'PHASE11_ACTION_AUTHORIZATION_INVALID';
  end if;

  select *
  into hypothesis_record
  from private.pentest_hypotheses
  where workspace_id = target_workspace_id
    and run_id = target_run_id
    and hypothesis_id = target_hypothesis_id;

  if not found
    or not (target_capability_id = any(hypothesis_record.candidate_capability_ids))
    or hypothesis_record.status <> 'eligible'
  then
    raise exception 'PHASE11_ACTION_HYPOTHESIS_INVALID';
  end if;

  select count(distinct node_id)::integer
  into target_count
  from unnest(target_node_ids) node_id;

  select count(distinct graph_node.node_id)::integer
  into matched_count
  from private.pentest_graph_nodes graph_node
  where graph_node.workspace_id = target_workspace_id
    and graph_node.run_id = target_run_id
    and graph_node.authorization_ref = target_authorization_snapshot_ref
    and graph_node.node_id = any(target_node_ids);

  if target_count <> matched_count then
    raise exception 'PHASE11_ACTION_TARGET_SCOPE_INVALID';
  end if;

  select *
  into existing_action
  from private.pentest_actions
  where workspace_id = target_workspace_id
    and run_id = target_run_id
    and action_id = target_action_id
  for update;

  if found then
    if existing_action.hypothesis_id is distinct from target_hypothesis_id
      or existing_action.capability_id is distinct from target_capability_id
      or existing_action.target_node_ids is distinct from target_node_ids
      or existing_action.requested_mode is distinct from target_requested_mode
      or existing_action.closed_parameters is distinct from target_closed_parameters
      or existing_action.expected_evidence_types is distinct from target_expected_evidence_types
      or existing_action.authorization_snapshot_ref is distinct from target_authorization_snapshot_ref
    then
      raise exception 'PHASE11_ACTION_IDENTITY_CONFLICT';
    end if;

    if existing_action.state in ('enqueueing', 'queued', 'running', 'terminal', 'cancelled', 'rejected') then
      return jsonb_build_object(
        'actionId', target_action_id,
        'state', existing_action.state,
        'shouldEnqueue', false,
        'replayed', true,
        'enqueueToken', existing_action.enqueue_token
      );
    end if;

    if target_decision_status = 'approval_required' then
      update private.pentest_actions
      set decision_status = target_decision_status,
          decision_reasons = coalesce(target_decision_reasons, '{}'),
          state = 'approval_required',
          updated_at = now()
      where workspace_id = target_workspace_id
        and run_id = target_run_id
        and action_id = target_action_id;

      return jsonb_build_object(
        'actionId', target_action_id,
        'state', 'approval_required',
        'shouldEnqueue', false,
        'replayed', true
      );
    end if;
  end if;

  if target_decision_status in ('approved', 'narrowed') then
    new_state := 'enqueueing';
    reservation_token := gen_random_uuid();
  elsif target_decision_status = 'approval_required' then
    new_state := 'approval_required';
    reservation_token := null;
  else
    new_state := 'rejected';
    reservation_token := null;
  end if;

  insert into private.pentest_actions (
    workspace_id,
    run_id,
    action_id,
    hypothesis_id,
    capability_id,
    target_node_ids,
    requested_mode,
    closed_parameters,
    expected_evidence_types,
    authorization_snapshot_ref,
    decision_status,
    decision_reasons,
    authorization_id,
    max_requests,
    max_runtime_ms,
    authorization_expires_at,
    cancellation_key,
    state,
    enqueue_token,
    queue_reference,
    created_at,
    updated_at
  )
  values (
    target_workspace_id,
    target_run_id,
    target_action_id,
    target_hypothesis_id,
    target_capability_id,
    target_node_ids,
    target_requested_mode,
    target_closed_parameters,
    target_expected_evidence_types,
    target_authorization_snapshot_ref,
    target_decision_status,
    coalesce(target_decision_reasons, '{}'),
    target_authorization_id,
    target_max_requests,
    target_max_runtime_ms,
    target_authorization_expires_at,
    target_cancellation_key,
    new_state,
    reservation_token,
    null,
    now(),
    now()
  )
  on conflict (workspace_id, run_id, action_id) do update
  set decision_status = excluded.decision_status,
      decision_reasons = excluded.decision_reasons,
      authorization_id = excluded.authorization_id,
      max_requests = excluded.max_requests,
      max_runtime_ms = excluded.max_runtime_ms,
      authorization_expires_at = excluded.authorization_expires_at,
      cancellation_key = excluded.cancellation_key,
      state = excluded.state,
      enqueue_token = excluded.enqueue_token,
      updated_at = excluded.updated_at;

  insert into public.pentest_action_summaries (
    workspace_id,
    run_id,
    action_id,
    hypothesis_id,
    capability_id,
    target_node_ids,
    requested_mode,
    state,
    created_at,
    updated_at
  )
  values (
    target_workspace_id,
    target_run_id,
    target_action_id,
    target_hypothesis_id,
    target_capability_id,
    target_node_ids,
    target_requested_mode,
    new_state,
    now(),
    now()
  )
  on conflict (workspace_id, run_id, action_id) do update
  set state = excluded.state,
      updated_at = excluded.updated_at;

  return jsonb_build_object(
    'actionId', target_action_id,
    'state', new_state,
    'shouldEnqueue', new_state = 'enqueueing',
    'replayed', false,
    'enqueueToken', reservation_token
  );
end;
$$;

create or replace function public.mark_phase11_action_queued(
  target_workspace_id uuid,
  target_run_id uuid,
  target_action_id text,
  target_enqueue_token uuid,
  target_queue_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  action_record private.pentest_actions%rowtype;
begin
  if target_queue_reference is null or char_length(target_queue_reference) not between 1 and 1024 then
    raise exception 'PHASE11_ACTION_QUEUE_REFERENCE_INVALID';
  end if;

  select *
  into action_record
  from private.pentest_actions
  where workspace_id = target_workspace_id
    and run_id = target_run_id
    and action_id = target_action_id
  for update;

  if not found then
    raise exception 'PHASE11_ACTION_NOT_FOUND';
  end if;

  if action_record.state = 'queued' and action_record.queue_reference = target_queue_reference then
    return jsonb_build_object('actionId', target_action_id, 'replayed', true);
  end if;

  if action_record.state <> 'enqueueing'
    or action_record.enqueue_token is distinct from target_enqueue_token
  then
    raise exception 'PHASE11_ACTION_ENQUEUE_RESERVATION_INVALID';
  end if;

  update private.pentest_actions
  set state = 'queued',
      queue_reference = target_queue_reference,
      enqueue_token = null,
      updated_at = now()
  where workspace_id = target_workspace_id
    and run_id = target_run_id
    and action_id = target_action_id;

  update public.pentest_action_summaries
  set state = 'queued',
      updated_at = now()
  where workspace_id = target_workspace_id
    and run_id = target_run_id
    and action_id = target_action_id;

  return jsonb_build_object('actionId', target_action_id, 'replayed', false);
end;
$$;

create or replace function public.release_phase11_action_enqueue(
  target_workspace_id uuid,
  target_run_id uuid,
  target_action_id text,
  target_enqueue_token uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.pentest_actions
  set state = 'authorized',
      enqueue_token = null,
      updated_at = now()
  where workspace_id = target_workspace_id
    and run_id = target_run_id
    and action_id = target_action_id
    and state = 'enqueueing'
    and enqueue_token = target_enqueue_token;

  if not found then
    raise exception 'PHASE11_ACTION_ENQUEUE_RESERVATION_INVALID';
  end if;

  update public.pentest_action_summaries
  set state = 'authorized',
      updated_at = now()
  where workspace_id = target_workspace_id
    and run_id = target_run_id
    and action_id = target_action_id;
end;
$$;

create or replace function public.approve_phase11_action(
  target_workspace_id uuid,
  target_run_id uuid,
  target_action_id text,
  target_actor_id uuid,
  target_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role public.workspace_role;
  action_record private.pentest_actions%rowtype;
begin
  select role
  into actor_role
  from public.workspace_members
  where workspace_id = target_workspace_id
    and user_id = target_actor_id;

  if actor_role is null or actor_role not in ('owner', 'admin') then
    raise exception 'PHASE11_APPROVAL_FORBIDDEN';
  end if;

  select *
  into action_record
  from private.pentest_actions
  where workspace_id = target_workspace_id
    and run_id = target_run_id
    and action_id = target_action_id
  for update;

  if not found
    or action_record.state <> 'approval_required'
    or action_record.requested_mode not in ('intrusive', 'validation')
  then
    raise exception 'PHASE11_APPROVAL_STATE_INVALID';
  end if;

  perform private.assert_phase11_active_authorization(
    target_workspace_id,
    target_run_id,
    action_record.authorization_snapshot_ref
  );

  if target_expires_at is null
    or target_expires_at <= now()
    or target_expires_at > (
      select expires_at
      from private.pentest_run_authorization_snapshots
      where workspace_id = target_workspace_id
        and run_id = target_run_id
        and snapshot_ref = action_record.authorization_snapshot_ref
    )
  then
    raise exception 'PHASE11_APPROVAL_EXPIRY_INVALID';
  end if;

  insert into private.pentest_approval_events (
    workspace_id,
    run_id,
    action_id,
    mode,
    approved_by,
    approved_by_role,
    expires_at
  )
  values (
    target_workspace_id,
    target_run_id,
    target_action_id,
    action_record.requested_mode,
    target_actor_id,
    actor_role::text,
    target_expires_at
  );

  return jsonb_build_object(
    'actionId', target_action_id,
    'mode', action_record.requested_mode,
    'approvedByRole', actor_role::text,
    'expiresAt', target_expires_at
  );
end;
$$;

create or replace function public.cancel_phase11_pentest_run(
  target_workspace_id uuid,
  target_run_id uuid,
  target_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role public.workspace_role;
  run_record private.pentest_runs%rowtype;
  was_cancelled boolean := false;
  queue_rows jsonb;
begin
  select role
  into actor_role
  from public.workspace_members
  where workspace_id = target_workspace_id
    and user_id = target_actor_id;

  if actor_role is null or actor_role not in ('owner', 'admin') then
    raise exception 'PHASE11_RUN_CANCEL_FORBIDDEN';
  end if;

  select *
  into run_record
  from private.pentest_runs
  where id = target_run_id
    and workspace_id = target_workspace_id
  for update;

  if not found then
    raise exception 'PHASE11_RUN_NOT_FOUND';
  end if;

  if run_record.status in ('completed', 'failed') then
    raise exception 'PHASE11_RUN_TERMINAL';
  end if;

  if run_record.status <> 'cancelled' then
    update private.pentest_runs
    set status = 'cancelled',
        stop_reason = 'cancelled',
        updated_at = now()
    where id = target_run_id and workspace_id = target_workspace_id;

    update public.pentest_run_summaries
    set status = 'cancelled',
        stop_reason = 'cancelled',
        updated_at = now()
    where run_id = target_run_id and workspace_id = target_workspace_id;

    update private.pentest_actions
    set state = 'cancelled',
        enqueue_token = null,
        updated_at = now()
    where workspace_id = target_workspace_id
      and run_id = target_run_id
      and state not in ('terminal', 'rejected', 'cancelled');

    update public.pentest_action_summaries
    set state = 'cancelled',
        updated_at = now()
    where workspace_id = target_workspace_id
      and run_id = target_run_id
      and state not in ('terminal', 'rejected', 'cancelled');

    was_cancelled := true;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'actionId', action.action_id,
    'queueReference', action.queue_reference
  ) order by action.action_id), '[]'::jsonb)
  into queue_rows
  from private.pentest_actions action
  where action.workspace_id = target_workspace_id
    and action.run_id = target_run_id
    and action.state = 'cancelled'
    and action.queue_reference is not null;

  return jsonb_build_object(
    'runId', target_run_id,
    'cancelled', true,
    'replayed', not was_cancelled,
    'activeQueues', queue_rows
  );
end;
$$;

create or replace function public.stop_phase11_pentest_run(
  target_workspace_id uuid,
  target_run_id uuid,
  target_authorization_snapshot_ref text,
  target_stop_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status text;
begin
  perform private.assert_phase11_run_scope(
    target_workspace_id,
    target_run_id,
    target_authorization_snapshot_ref
  );

  if target_stop_reason not in (
    'cancelled', 'deadline_reached', 'request_budget_exhausted',
    'graph_expansion_limit', 'provider_failure_limit', 'no_eligible_hypotheses',
    'approval_required', 'authorization_expired', 'coverage_complete'
  ) then
    raise exception 'PHASE11_STOP_REASON_INVALID';
  end if;

  next_status := case
    when target_stop_reason = 'cancelled' then 'cancelled'
    when target_stop_reason = 'approval_required' then 'waiting_approval'
    when target_stop_reason in ('coverage_complete', 'no_eligible_hypotheses') then 'completed'
    else 'failed'
  end;

  update private.pentest_runs
  set status = next_status,
      stop_reason = target_stop_reason,
      updated_at = now()
  where id = target_run_id
    and workspace_id = target_workspace_id
    and status not in ('completed', 'cancelled', 'failed');

  update public.pentest_run_summaries
  set status = next_status,
      stop_reason = target_stop_reason,
      updated_at = now()
  where run_id = target_run_id
    and workspace_id = target_workspace_id;
end;
$$;

revoke all on function public.create_phase11_pentest_run(
  uuid, uuid, uuid, uuid, text, text, text[], text, timestamptz, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.create_phase11_pentest_run(
  uuid, uuid, uuid, uuid, text, text, text[], text, timestamptz, jsonb, timestamptz
) to service_role;

revoke all on function public.load_phase11_pentest_run_state(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.load_phase11_pentest_run_state(uuid, uuid, text)
  to service_role;

revoke all on function public.record_phase11_action_decision(
  uuid, uuid, text, text, text, text, text[], text, jsonb, text[], text, text[], text, integer, integer, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.record_phase11_action_decision(
  uuid, uuid, text, text, text, text, text[], text, jsonb, text[], text, text[], text, integer, integer, timestamptz, text
) to service_role;

revoke all on function public.mark_phase11_action_queued(uuid, uuid, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.mark_phase11_action_queued(uuid, uuid, text, uuid, text)
  to service_role;

revoke all on function public.release_phase11_action_enqueue(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.release_phase11_action_enqueue(uuid, uuid, text, uuid)
  to service_role;

revoke all on function public.approve_phase11_action(uuid, uuid, text, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.approve_phase11_action(uuid, uuid, text, uuid, timestamptz)
  to service_role;

revoke all on function public.cancel_phase11_pentest_run(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cancel_phase11_pentest_run(uuid, uuid, uuid)
  to service_role;

revoke all on function public.stop_phase11_pentest_run(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.stop_phase11_pentest_run(uuid, uuid, text, text)
  to service_role;
