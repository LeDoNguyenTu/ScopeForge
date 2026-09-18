create table public.pentest_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  state text not null default 'created' check (
    state in ('created', 'running', 'approval_wait', 'cancelled', 'completed', 'failed')
  ),
  execution_mode_ceiling text not null check (
    execution_mode_ceiling in ('passive', 'safe_active', 'intrusive', 'validation')
  ),
  request_budget integer not null check (request_budget > 0 and request_budget <= 100000),
  graph_expansion_limit integer not null check (graph_expansion_limit > 0 and graph_expansion_limit <= 100000),
  provider_failure_limit integer not null check (provider_failure_limit > 0 and provider_failure_limit <= 1000),
  started_at timestamptz not null,
  deadline_at timestamptz not null check (deadline_at > started_at),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table public.pentest_run_authorization_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  run_id uuid not null,
  snapshot_ref text not null check (char_length(snapshot_ref) between 1 and 255),
  authorized_node_ids text[] not null check (
    cardinality(authorized_node_ids) between 1 and 1024
    and array_position(authorized_node_ids, '') is null
  ),
  max_execution_mode text not null check (
    max_execution_mode in ('passive', 'safe_active', 'intrusive', 'validation')
  ),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (run_id, snapshot_ref),
  constraint pentest_run_authorization_snapshots_run_workspace_fkey
    foreign key (run_id, workspace_id)
    references public.pentest_runs(id, workspace_id)
    on delete cascade
);

create table public.pentest_graph_nodes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  run_id uuid not null,
  asset_node_id text not null check (char_length(asset_node_id) between 1 and 512),
  asset_type text not null check (
    asset_type in (
      'repository', 'domain', 'hostname', 'ip_endpoint', 'http_service', 'api',
      'api_operation', 'cloud_account', 'cloud_resource', 'container_image',
      'kubernetes_workload', 'mobile_application', 'identity'
    )
  ),
  canonical_locator text not null check (char_length(canonical_locator) between 1 and 2048),
  parent_node_ids text[] not null default '{}'::text[] check (cardinality(parent_node_ids) <= 256),
  authorization_ref text not null check (char_length(authorization_ref) between 1 and 255),
  technology_tags text[] not null default '{}'::text[] check (cardinality(technology_tags) <= 256),
  confidence double precision not null check (confidence between 0 and 1),
  provenance_refs text[] not null check (
    cardinality(provenance_refs) between 1 and 256
    and array_position(provenance_refs, '') is null
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, asset_node_id),
  unique (workspace_id, run_id, asset_node_id),
  constraint pentest_graph_nodes_run_workspace_fkey
    foreign key (run_id, workspace_id)
    references public.pentest_runs(id, workspace_id)
    on delete cascade
);

create table public.pentest_graph_edges (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  run_id uuid not null,
  edge_id text not null check (char_length(edge_id) between 1 and 1536),
  from_node_id text not null check (char_length(from_node_id) between 1 and 512),
  to_node_id text not null check (
    char_length(to_node_id) between 1 and 512
    and to_node_id <> from_node_id
  ),
  relationship text not null check (
    relationship in (
      'exposes', 'depends_on', 'authenticates_to', 'trusts', 'deploys_to',
      'contains', 'reachable_from', 'affected_by', 'enables'
    )
  ),
  provenance_kind text not null check (
    provenance_kind in ('observed', 'scanner-derived', 'user-confirmed')
  ),
  provenance_refs text[] not null check (
    cardinality(provenance_refs) between 1 and 256
    and array_position(provenance_refs, '') is null
  ),
  confidence double precision not null check (confidence between 0 and 1),
  observed_at timestamptz not null,
  authorization_ref text not null check (char_length(authorization_ref) between 1 and 255),
  stale boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, edge_id),
  constraint pentest_graph_edges_run_workspace_fkey
    foreign key (run_id, workspace_id)
    references public.pentest_runs(id, workspace_id)
    on delete cascade,
  constraint pentest_graph_edges_source_fkey
    foreign key (workspace_id, run_id, from_node_id)
    references public.pentest_graph_nodes(workspace_id, run_id, asset_node_id)
    on delete cascade,
  constraint pentest_graph_edges_target_fkey
    foreign key (workspace_id, run_id, to_node_id)
    references public.pentest_graph_nodes(workspace_id, run_id, asset_node_id)
    on delete cascade
);

create table public.pentest_observations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  run_id uuid not null,
  observation_id text not null check (char_length(observation_id) between 1 and 1024),
  provider_id text not null check (char_length(provider_id) between 1 and 160),
  provider_version text not null check (char_length(provider_version) between 1 and 160),
  capability_id text not null check (char_length(capability_id) between 1 and 255),
  asset_node_ids text[] not null check (
    cardinality(asset_node_ids) between 1 and 256
    and array_position(asset_node_ids, '') is null
  ),
  evidence_refs text[] not null check (
    cardinality(evidence_refs) between 1 and 256
    and array_position(evidence_refs, '') is null
  ),
  facts jsonb not null check (
    jsonb_typeof(facts) = 'object'
    and pg_column_size(facts) <= 16384
  ),
  observed_at timestamptz not null,
  confidence double precision not null check (confidence between 0 and 1),
  authorization_snapshot_ref text not null check (
    char_length(authorization_snapshot_ref) between 1 and 255
  ),
  execution_mode text not null check (
    execution_mode in ('passive', 'safe_active', 'intrusive', 'validation')
  ),
  created_at timestamptz not null default now(),
  unique (run_id, observation_id),
  constraint pentest_observations_run_workspace_fkey
    foreign key (run_id, workspace_id)
    references public.pentest_runs(id, workspace_id)
    on delete cascade
);

create table public.pentest_hypotheses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  run_id uuid not null,
  hypothesis_id text not null check (char_length(hypothesis_id) between 1 and 1024),
  reasoning_source text not null check (char_length(reasoning_source) between 1 and 255),
  target_node_ids text[] not null check (
    cardinality(target_node_ids) between 1 and 256
    and array_position(target_node_ids, '') is null
  ),
  statement text not null check (char_length(statement) between 1 and 4096),
  preconditions text[] not null default '{}'::text[] check (cardinality(preconditions) <= 256),
  candidate_capability_ids text[] not null check (
    cardinality(candidate_capability_ids) between 1 and 256
  ),
  expected_evidence_types text[] not null default '{}'::text[] check (
    cardinality(expected_evidence_types) <= 256
  ),
  base_confidence double precision not null check (base_confidence between 0 and 1),
  confidence double precision not null check (confidence between 0 and 1),
  status text not null check (
    status in ('proposed', 'eligible', 'blocked', 'testing', 'supported', 'refuted', 'exhausted')
  ),
  evidence_refs text[] not null default '{}'::text[] check (cardinality(evidence_refs) <= 256),
  authorization_snapshot_ref text not null check (
    char_length(authorization_snapshot_ref) between 1 and 255
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, hypothesis_id),
  constraint pentest_hypotheses_terminal_evidence_check check (
    status not in ('supported', 'refuted') or cardinality(evidence_refs) > 0
  ),
  constraint pentest_hypotheses_run_workspace_fkey
    foreign key (run_id, workspace_id)
    references public.pentest_runs(id, workspace_id)
    on delete cascade
);

create table public.pentest_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  run_id uuid not null,
  action_id text not null check (char_length(action_id) between 1 and 1536),
  hypothesis_id text not null check (char_length(hypothesis_id) between 1 and 1024),
  capability_id text not null check (char_length(capability_id) between 1 and 255),
  target_node_ids text[] not null check (
    cardinality(target_node_ids) between 1 and 256
    and array_position(target_node_ids, '') is null
  ),
  requested_mode text not null check (
    requested_mode in ('passive', 'safe_active', 'intrusive', 'validation')
  ),
  closed_parameters jsonb not null default '{}'::jsonb check (
    jsonb_typeof(closed_parameters) = 'object'
    and pg_column_size(closed_parameters) <= 8192
  ),
  expected_evidence_types text[] not null check (
    cardinality(expected_evidence_types) between 1 and 256
  ),
  authorization_snapshot_ref text not null check (
    char_length(authorization_snapshot_ref) between 1 and 255
  ),
  state text not null default 'planned' check (
    state in ('planned', 'approval_required', 'authorized', 'queued', 'running', 'terminal')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, action_id),
  constraint pentest_actions_run_workspace_fkey
    foreign key (run_id, workspace_id)
    references public.pentest_runs(id, workspace_id)
    on delete cascade
);

create table public.pentest_action_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  run_id uuid not null,
  action_id text not null,
  authorization_id text not null check (char_length(authorization_id) between 1 and 2048),
  provider_id text not null check (char_length(provider_id) between 1 and 160),
  provider_version text not null check (char_length(provider_version) between 1 and 160),
  status text not null check (
    status in (
      'succeeded', 'no_signal', 'blocked', 'cancelled', 'timed_out',
      'provider_failed', 'policy_rejected'
    )
  ),
  observation_ids text[] not null default '{}'::text[] check (cardinality(observation_ids) <= 256),
  evidence_refs text[] not null default '{}'::text[] check (cardinality(evidence_refs) <= 256),
  started_at timestamptz not null,
  completed_at timestamptz not null check (completed_at >= started_at),
  error_code text check (
    error_code is null
    or (char_length(error_code) between 1 and 100 and error_code ~ '^[A-Z0-9_]+$')
  ),
  created_at timestamptz not null default now(),
  constraint pentest_action_attempts_run_workspace_fkey
    foreign key (run_id, workspace_id)
    references public.pentest_runs(id, workspace_id)
    on delete cascade,
  constraint pentest_action_attempts_action_fkey
    foreign key (run_id, action_id)
    references public.pentest_actions(run_id, action_id)
    on delete cascade
);

create table public.pentest_coverage (
  run_id uuid primary key,
  workspace_id uuid not null,
  authorization_snapshot_ref text not null check (
    char_length(authorization_snapshot_ref) between 1 and 255
  ),
  attempted_capability_ids text[] not null default '{}'::text[] check (
    cardinality(attempted_capability_ids) <= 1024
  ),
  covered_node_ids text[] not null default '{}'::text[] check (cardinality(covered_node_ids) <= 4096),
  untested_node_ids text[] not null default '{}'::text[] check (cardinality(untested_node_ids) <= 4096),
  request_count integer not null default 0 check (request_count >= 0),
  graph_expansion_count integer not null default 0 check (graph_expansion_count >= 0),
  provider_failure_count integer not null default 0 check (provider_failure_count >= 0),
  started_at timestamptz not null,
  deadline_at timestamptz not null check (deadline_at > started_at),
  updated_at timestamptz not null default now(),
  constraint pentest_coverage_run_workspace_fkey
    foreign key (run_id, workspace_id)
    references public.pentest_runs(id, workspace_id)
    on delete cascade
);

create table public.pentest_approval_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  run_id uuid not null,
  action_id text not null,
  mode text not null check (mode in ('intrusive', 'validation')),
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_by_role text not null check (approved_by_role in ('owner', 'admin')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint pentest_approval_events_run_workspace_fkey
    foreign key (run_id, workspace_id)
    references public.pentest_runs(id, workspace_id)
    on delete cascade,
  constraint pentest_approval_events_action_fkey
    foreign key (run_id, action_id)
    references public.pentest_actions(run_id, action_id)
    on delete cascade
);

create table public.pentest_run_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  run_id uuid not null,
  authorization_snapshot_ref text not null check (
    char_length(authorization_snapshot_ref) between 1 and 255
  ),
  event_type text not null check (
    char_length(event_type) between 1 and 100
    and event_type ~ '^[A-Z0-9_]+$'
  ),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
    and pg_column_size(metadata) <= 8192
  ),
  created_at timestamptz not null default now(),
  constraint pentest_run_events_run_workspace_fkey
    foreign key (run_id, workspace_id)
    references public.pentest_runs(id, workspace_id)
    on delete cascade
);

create index pentest_runs_workspace_state_idx
  on public.pentest_runs(workspace_id, state, updated_at desc);
create index pentest_authorization_run_expiry_idx
  on public.pentest_run_authorization_snapshots(run_id, expires_at desc);
create index pentest_graph_nodes_workspace_run_idx
  on public.pentest_graph_nodes(workspace_id, run_id, updated_at desc);
create index pentest_graph_edges_workspace_run_idx
  on public.pentest_graph_edges(workspace_id, run_id, updated_at desc);
create index pentest_observations_workspace_run_idx
  on public.pentest_observations(workspace_id, run_id, observed_at desc);
create index pentest_hypotheses_workspace_run_status_idx
  on public.pentest_hypotheses(workspace_id, run_id, status, updated_at desc);
create index pentest_actions_workspace_run_state_idx
  on public.pentest_actions(workspace_id, run_id, state, updated_at desc);
create index pentest_action_attempts_run_action_idx
  on public.pentest_action_attempts(run_id, action_id, created_at desc);
create index pentest_approval_events_run_action_idx
  on public.pentest_approval_events(run_id, action_id, created_at desc);
create index pentest_run_events_workspace_run_idx
  on public.pentest_run_events(workspace_id, run_id, created_at desc);

create trigger pentest_runs_set_updated_at
before update on public.pentest_runs
for each row execute function private.set_updated_at();

create trigger pentest_graph_nodes_set_updated_at
before update on public.pentest_graph_nodes
for each row execute function private.set_updated_at();

create trigger pentest_graph_edges_set_updated_at
before update on public.pentest_graph_edges
for each row execute function private.set_updated_at();

create trigger pentest_hypotheses_set_updated_at
before update on public.pentest_hypotheses
for each row execute function private.set_updated_at();

create trigger pentest_actions_set_updated_at
before update on public.pentest_actions
for each row execute function private.set_updated_at();

create trigger pentest_coverage_set_updated_at
before update on public.pentest_coverage
for each row execute function private.set_updated_at();

alter table public.pentest_runs enable row level security;
alter table public.pentest_run_authorization_snapshots enable row level security;
alter table public.pentest_graph_nodes enable row level security;
alter table public.pentest_graph_edges enable row level security;
alter table public.pentest_observations enable row level security;
alter table public.pentest_hypotheses enable row level security;
alter table public.pentest_actions enable row level security;
alter table public.pentest_action_attempts enable row level security;
alter table public.pentest_coverage enable row level security;
alter table public.pentest_approval_events enable row level security;
alter table public.pentest_run_events enable row level security;

revoke all on table public.pentest_runs from public, anon, authenticated, service_role;
revoke all on table public.pentest_run_authorization_snapshots from public, anon, authenticated, service_role;
revoke all on table public.pentest_graph_nodes from public, anon, authenticated, service_role;
revoke all on table public.pentest_graph_edges from public, anon, authenticated, service_role;
revoke all on table public.pentest_observations from public, anon, authenticated, service_role;
revoke all on table public.pentest_hypotheses from public, anon, authenticated, service_role;
revoke all on table public.pentest_actions from public, anon, authenticated, service_role;
revoke all on table public.pentest_action_attempts from public, anon, authenticated, service_role;
revoke all on table public.pentest_coverage from public, anon, authenticated, service_role;
revoke all on table public.pentest_approval_events from public, anon, authenticated, service_role;
revoke all on table public.pentest_run_events from public, anon, authenticated, service_role;

grant select on table public.pentest_runs to authenticated;
grant select on table public.pentest_graph_nodes to authenticated;
grant select on table public.pentest_graph_edges to authenticated;
grant select on table public.pentest_observations to authenticated;
grant select on table public.pentest_hypotheses to authenticated;
grant select on table public.pentest_coverage to authenticated;

grant select, insert, update, delete on table public.pentest_runs to service_role;
grant select, insert, update, delete on table public.pentest_run_authorization_snapshots to service_role;
grant select, insert, update, delete on table public.pentest_graph_nodes to service_role;
grant select, insert, update, delete on table public.pentest_graph_edges to service_role;
grant select, insert, update, delete on table public.pentest_observations to service_role;
grant select, insert, update, delete on table public.pentest_hypotheses to service_role;
grant select, insert, update, delete on table public.pentest_actions to service_role;
grant select, insert, update, delete on table public.pentest_action_attempts to service_role;
grant select, insert, update, delete on table public.pentest_coverage to service_role;
grant select, insert, update, delete on table public.pentest_approval_events to service_role;
grant select, insert, update, delete on table public.pentest_run_events to service_role;

create policy pentest_runs_select_member on public.pentest_runs
for select to authenticated
using (private.is_workspace_member(workspace_id));

create policy pentest_graph_nodes_select_member on public.pentest_graph_nodes
for select to authenticated
using (private.is_workspace_member(workspace_id));

create policy pentest_graph_edges_select_member on public.pentest_graph_edges
for select to authenticated
using (private.is_workspace_member(workspace_id));

create policy pentest_observations_select_member on public.pentest_observations
for select to authenticated
using (private.is_workspace_member(workspace_id));

create policy pentest_hypotheses_select_member on public.pentest_hypotheses
for select to authenticated
using (private.is_workspace_member(workspace_id));

create policy pentest_coverage_select_member on public.pentest_coverage
for select to authenticated
using (private.is_workspace_member(workspace_id));

create or replace function private.assert_pentest_run_binding(
  target_workspace_id uuid,
  target_run_id uuid,
  target_authorization_snapshot_ref text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
      from public.pentest_runs
     where id = target_run_id
       and workspace_id = target_workspace_id
       and state in ('created', 'running', 'approval_wait')
  ) then
    raise exception 'PENTEST_RUN_BINDING_INVALID';
  end if;

  if not exists (
    select 1
      from public.pentest_run_authorization_snapshots
     where workspace_id = target_workspace_id
       and run_id = target_run_id
       and snapshot_ref = target_authorization_snapshot_ref
       and expires_at > now()
  ) then
    raise exception 'PENTEST_AUTHORIZATION_INVALID';
  end if;
end;
$$;

revoke all on function private.assert_pentest_run_binding(uuid, uuid, text)
  from public, anon, authenticated, service_role;

create or replace function public.upsert_pentest_graph_node(
  target_workspace_id uuid,
  target_run_id uuid,
  target_authorization_snapshot_ref text,
  target_asset_node_id text,
  target_asset_type text,
  target_canonical_locator text,
  target_parent_node_ids text[],
  target_technology_tags text[],
  target_confidence double precision,
  target_provenance_refs text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_record public.pentest_graph_nodes%rowtype;
  persisted_id uuid;
begin
  perform private.assert_pentest_run_binding(
    target_workspace_id,
    target_run_id,
    target_authorization_snapshot_ref
  );

  if target_asset_node_id is null
     or char_length(target_asset_node_id) not between 1 and 512
     or target_asset_type is null
     or target_asset_type not in (
       'repository', 'domain', 'hostname', 'ip_endpoint', 'http_service', 'api',
       'api_operation', 'cloud_account', 'cloud_resource', 'container_image',
       'kubernetes_workload', 'mobile_application', 'identity'
     )
     or target_canonical_locator is null
     or char_length(target_canonical_locator) not between 1 and 2048
     or target_confidence is null
     or target_confidence < 0
     or target_confidence > 1
     or target_provenance_refs is null
     or cardinality(target_provenance_refs) < 1 then
    raise exception 'PENTEST_GRAPH_NODE_INVALID';
  end if;

  select * into existing_record
    from public.pentest_graph_nodes
   where run_id = target_run_id
     and asset_node_id = target_asset_node_id
   for update;

  if existing_record.id is not null
     and (
       existing_record.workspace_id <> target_workspace_id
       or existing_record.asset_type <> target_asset_type
       or existing_record.canonical_locator <> target_canonical_locator
       or existing_record.authorization_ref <> target_authorization_snapshot_ref
     ) then
    raise exception 'PENTEST_GRAPH_NODE_IDENTITY_CONFLICT';
  end if;

  insert into public.pentest_graph_nodes (
    workspace_id,
    run_id,
    asset_node_id,
    asset_type,
    canonical_locator,
    parent_node_ids,
    authorization_ref,
    technology_tags,
    confidence,
    provenance_refs
  )
  values (
    target_workspace_id,
    target_run_id,
    target_asset_node_id,
    target_asset_type,
    target_canonical_locator,
    coalesce(target_parent_node_ids, '{}'::text[]),
    target_authorization_snapshot_ref,
    coalesce(target_technology_tags, '{}'::text[]),
    target_confidence,
    target_provenance_refs
  )
  on conflict (run_id, asset_node_id) do update
    set parent_node_ids = (
          select coalesce(array_agg(distinct value order by value), '{}'::text[])
          from unnest(public.pentest_graph_nodes.parent_node_ids || excluded.parent_node_ids) value
        ),
        technology_tags = (
          select coalesce(array_agg(distinct value order by value), '{}'::text[])
          from unnest(public.pentest_graph_nodes.technology_tags || excluded.technology_tags) value
        ),
        confidence = greatest(public.pentest_graph_nodes.confidence, excluded.confidence),
        provenance_refs = (
          select array_agg(distinct value order by value)
          from unnest(public.pentest_graph_nodes.provenance_refs || excluded.provenance_refs) value
        )
  returning id into persisted_id;

  return jsonb_build_object('id', persisted_id, 'assetNodeId', target_asset_node_id);
end;
$$;

revoke all on function public.upsert_pentest_graph_node(
  uuid, uuid, text, text, text, text, text[], text[], double precision, text[]
) from public, anon, authenticated, service_role;
grant execute on function public.upsert_pentest_graph_node(
  uuid, uuid, text, text, text, text, text[], text[], double precision, text[]
) to service_role;

create or replace function public.upsert_pentest_graph_edge(
  target_workspace_id uuid,
  target_run_id uuid,
  target_authorization_snapshot_ref text,
  target_edge_id text,
  target_from_node_id text,
  target_to_node_id text,
  target_relationship text,
  target_provenance_kind text,
  target_provenance_refs text[],
  target_confidence double precision,
  target_observed_at timestamptz,
  target_stale boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_record public.pentest_graph_edges%rowtype;
  persisted_id uuid;
begin
  perform private.assert_pentest_run_binding(
    target_workspace_id,
    target_run_id,
    target_authorization_snapshot_ref
  );

  if target_edge_id is null
     or char_length(target_edge_id) not between 1 and 1536
     or target_from_node_id is null
     or target_to_node_id is null
     or target_from_node_id = target_to_node_id
     or target_relationship is null
     or target_relationship not in (
       'exposes', 'depends_on', 'authenticates_to', 'trusts', 'deploys_to',
       'contains', 'reachable_from', 'affected_by', 'enables'
     )
     or target_provenance_kind is null
     or target_provenance_kind not in ('observed', 'scanner-derived', 'user-confirmed')
     or target_provenance_refs is null
     or cardinality(target_provenance_refs) < 1
     or target_confidence is null
     or target_confidence < 0
     or target_confidence > 1
     or target_observed_at is null
     or target_stale is null then
    raise exception 'PENTEST_GRAPH_EDGE_INVALID';
  end if;

  if not exists (
    select 1 from public.pentest_graph_nodes
     where workspace_id = target_workspace_id
       and run_id = target_run_id
       and asset_node_id = target_from_node_id
       and authorization_ref = target_authorization_snapshot_ref
  ) or not exists (
    select 1 from public.pentest_graph_nodes
     where workspace_id = target_workspace_id
       and run_id = target_run_id
       and asset_node_id = target_to_node_id
       and authorization_ref = target_authorization_snapshot_ref
  ) then
    raise exception 'PENTEST_GRAPH_EDGE_NODE_BINDING_INVALID';
  end if;

  select * into existing_record
    from public.pentest_graph_edges
   where run_id = target_run_id
     and edge_id = target_edge_id
   for update;

  if existing_record.id is not null
     and (
       existing_record.workspace_id <> target_workspace_id
       or existing_record.from_node_id <> target_from_node_id
       or existing_record.to_node_id <> target_to_node_id
       or existing_record.relationship <> target_relationship
       or existing_record.authorization_ref <> target_authorization_snapshot_ref
     ) then
    raise exception 'PENTEST_GRAPH_EDGE_IDENTITY_CONFLICT';
  end if;

  insert into public.pentest_graph_edges (
    workspace_id,
    run_id,
    edge_id,
    from_node_id,
    to_node_id,
    relationship,
    provenance_kind,
    provenance_refs,
    confidence,
    observed_at,
    authorization_ref,
    stale
  )
  values (
    target_workspace_id,
    target_run_id,
    target_edge_id,
    target_from_node_id,
    target_to_node_id,
    target_relationship,
    target_provenance_kind,
    target_provenance_refs,
    target_confidence,
    target_observed_at,
    target_authorization_snapshot_ref,
    target_stale
  )
  on conflict (run_id, edge_id) do update
    set provenance_refs = (
          select array_agg(distinct value order by value)
          from unnest(public.pentest_graph_edges.provenance_refs || excluded.provenance_refs) value
        ),
        confidence = greatest(public.pentest_graph_edges.confidence, excluded.confidence),
        observed_at = greatest(public.pentest_graph_edges.observed_at, excluded.observed_at),
        stale = public.pentest_graph_edges.stale and excluded.stale
  returning id into persisted_id;

  return jsonb_build_object('id', persisted_id, 'edgeId', target_edge_id);
end;
$$;

revoke all on function public.upsert_pentest_graph_edge(
  uuid, uuid, text, text, text, text, text, text, text[], double precision, timestamptz, boolean
) from public, anon, authenticated, service_role;
grant execute on function public.upsert_pentest_graph_edge(
  uuid, uuid, text, text, text, text, text, text, text[], double precision, timestamptz, boolean
) to service_role;

create or replace function public.record_pentest_observation(
  target_workspace_id uuid,
  target_run_id uuid,
  target_authorization_snapshot_ref text,
  target_observation_id text,
  target_provider_id text,
  target_provider_version text,
  target_capability_id text,
  target_asset_node_ids text[],
  target_evidence_refs text[],
  target_facts jsonb,
  target_observed_at timestamptz,
  target_confidence double precision,
  target_execution_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_record public.pentest_observations%rowtype;
  target_node_count integer;
  matched_node_count integer;
  persisted_id uuid;
begin
  perform private.assert_pentest_run_binding(
    target_workspace_id,
    target_run_id,
    target_authorization_snapshot_ref
  );

  if target_observation_id is null
     or char_length(target_observation_id) not between 1 and 1024
     or target_provider_id is null
     or char_length(target_provider_id) not between 1 and 160
     or target_provider_version is null
     or char_length(target_provider_version) not between 1 and 160
     or target_capability_id is null
     or char_length(target_capability_id) not between 1 and 255
     or target_asset_node_ids is null
     or cardinality(target_asset_node_ids) < 1
     or target_evidence_refs is null
     or cardinality(target_evidence_refs) < 1
     or target_facts is null
     or jsonb_typeof(target_facts) <> 'object'
     or pg_column_size(target_facts) > 16384
     or target_observed_at is null
     or target_confidence is null
     or target_confidence < 0
     or target_confidence > 1
     or target_execution_mode not in ('passive', 'safe_active', 'intrusive', 'validation') then
    raise exception 'PENTEST_OBSERVATION_INVALID';
  end if;

  select count(distinct node_id)::integer into target_node_count
    from unnest(target_asset_node_ids) node_id;

  select count(distinct n.asset_node_id)::integer into matched_node_count
    from public.pentest_graph_nodes n
   where n.workspace_id = target_workspace_id
     and n.run_id = target_run_id
     and n.authorization_ref = target_authorization_snapshot_ref
     and n.asset_node_id = any(target_asset_node_ids);

  if target_node_count <> matched_node_count then
    raise exception 'PENTEST_OBSERVATION_NODE_BINDING_INVALID';
  end if;

  select * into existing_record
    from public.pentest_observations
   where run_id = target_run_id
     and observation_id = target_observation_id;

  if existing_record.id is not null then
    if existing_record.workspace_id <> target_workspace_id
       or existing_record.provider_id <> target_provider_id
       or existing_record.provider_version <> target_provider_version
       or existing_record.capability_id <> target_capability_id
       or existing_record.asset_node_ids <> target_asset_node_ids
       or existing_record.evidence_refs <> target_evidence_refs
       or existing_record.facts <> target_facts
       or existing_record.observed_at <> target_observed_at
       or existing_record.confidence <> target_confidence
       or existing_record.authorization_snapshot_ref <> target_authorization_snapshot_ref
       or existing_record.execution_mode <> target_execution_mode then
      raise exception 'PENTEST_OBSERVATION_IDENTITY_CONFLICT';
    end if;
    return jsonb_build_object('id', existing_record.id, 'observationId', target_observation_id, 'replayed', true);
  end if;

  insert into public.pentest_observations (
    workspace_id,
    run_id,
    observation_id,
    provider_id,
    provider_version,
    capability_id,
    asset_node_ids,
    evidence_refs,
    facts,
    observed_at,
    confidence,
    authorization_snapshot_ref,
    execution_mode
  )
  values (
    target_workspace_id,
    target_run_id,
    target_observation_id,
    target_provider_id,
    target_provider_version,
    target_capability_id,
    target_asset_node_ids,
    target_evidence_refs,
    target_facts,
    target_observed_at,
    target_confidence,
    target_authorization_snapshot_ref,
    target_execution_mode
  )
  returning id into persisted_id;

  return jsonb_build_object('id', persisted_id, 'observationId', target_observation_id, 'replayed', false);
end;
$$;

revoke all on function public.record_pentest_observation(
  uuid, uuid, text, text, text, text, text, text[], text[], jsonb, timestamptz, double precision, text
) from public, anon, authenticated, service_role;
grant execute on function public.record_pentest_observation(
  uuid, uuid, text, text, text, text, text, text[], text[], jsonb, timestamptz, double precision, text
) to service_role;

create or replace function public.upsert_pentest_hypothesis(
  target_workspace_id uuid,
  target_run_id uuid,
  target_authorization_snapshot_ref text,
  target_hypothesis_id text,
  target_reasoning_source text,
  target_target_node_ids text[],
  target_statement text,
  target_preconditions text[],
  target_candidate_capability_ids text[],
  target_expected_evidence_types text[],
  target_base_confidence double precision,
  target_confidence double precision,
  target_status text,
  target_evidence_refs text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_node_count integer;
  target_node_count integer;
  persisted_id uuid;
begin
  perform private.assert_pentest_run_binding(
    target_workspace_id,
    target_run_id,
    target_authorization_snapshot_ref
  );

  if target_hypothesis_id is null
     or char_length(target_hypothesis_id) not between 1 and 1024
     or target_reasoning_source is null
     or char_length(target_reasoning_source) not between 1 and 255
     or target_target_node_ids is null
     or cardinality(target_target_node_ids) < 1
     or target_statement is null
     or char_length(target_statement) not between 1 and 4096
     or target_candidate_capability_ids is null
     or cardinality(target_candidate_capability_ids) < 1
     or target_base_confidence is null
     or target_base_confidence < 0
     or target_base_confidence > 1
     or target_confidence is null
     or target_confidence < 0
     or target_confidence > 1
     or target_status not in (
       'proposed', 'eligible', 'blocked', 'testing', 'supported', 'refuted', 'exhausted'
     )
     or (
       target_status in ('supported', 'refuted')
       and cardinality(coalesce(target_evidence_refs, '{}'::text[])) = 0
     ) then
    raise exception 'PENTEST_HYPOTHESIS_INVALID';
  end if;

  select count(distinct node_id)::integer into target_node_count
    from unnest(target_target_node_ids) node_id;

  select count(distinct n.asset_node_id)::integer into matched_node_count
    from public.pentest_graph_nodes n
   where n.workspace_id = target_workspace_id
     and n.run_id = target_run_id
     and n.authorization_ref = target_authorization_snapshot_ref
     and n.asset_node_id = any(target_target_node_ids);

  if target_node_count <> matched_node_count then
    raise exception 'PENTEST_HYPOTHESIS_NODE_BINDING_INVALID';
  end if;

  insert into public.pentest_hypotheses (
    workspace_id,
    run_id,
    hypothesis_id,
    reasoning_source,
    target_node_ids,
    statement,
    preconditions,
    candidate_capability_ids,
    expected_evidence_types,
    base_confidence,
    confidence,
    status,
    evidence_refs,
    authorization_snapshot_ref
  )
  values (
    target_workspace_id,
    target_run_id,
    target_hypothesis_id,
    target_reasoning_source,
    target_target_node_ids,
    target_statement,
    coalesce(target_preconditions, '{}'::text[]),
    target_candidate_capability_ids,
    coalesce(target_expected_evidence_types, '{}'::text[]),
    target_base_confidence,
    target_confidence,
    target_status,
    coalesce(target_evidence_refs, '{}'::text[]),
    target_authorization_snapshot_ref
  )
  on conflict (run_id, hypothesis_id) do update
    set reasoning_source = excluded.reasoning_source,
        target_node_ids = excluded.target_node_ids,
        statement = excluded.statement,
        preconditions = excluded.preconditions,
        candidate_capability_ids = excluded.candidate_capability_ids,
        expected_evidence_types = excluded.expected_evidence_types,
        base_confidence = excluded.base_confidence,
        confidence = excluded.confidence,
        status = excluded.status,
        evidence_refs = excluded.evidence_refs,
        authorization_snapshot_ref = excluded.authorization_snapshot_ref
  where public.pentest_hypotheses.workspace_id = excluded.workspace_id
  returning id into persisted_id;

  if persisted_id is null then
    raise exception 'PENTEST_HYPOTHESIS_BINDING_CONFLICT';
  end if;

  return jsonb_build_object('id', persisted_id, 'hypothesisId', target_hypothesis_id);
end;
$$;

revoke all on function public.upsert_pentest_hypothesis(
  uuid, uuid, text, text, text, text[], text, text[], text[], text[], double precision, double precision, text, text[]
) from public, anon, authenticated, service_role;
grant execute on function public.upsert_pentest_hypothesis(
  uuid, uuid, text, text, text, text[], text, text[], text[], text[], double precision, double precision, text, text[]
) to service_role;

create or replace function public.upsert_pentest_coverage(
  target_workspace_id uuid,
  target_run_id uuid,
  target_authorization_snapshot_ref text,
  target_attempted_capability_ids text[],
  target_covered_node_ids text[],
  target_untested_node_ids text[],
  target_request_count integer,
  target_graph_expansion_count integer,
  target_provider_failure_count integer,
  target_started_at timestamptz,
  target_deadline_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_pentest_run_binding(
    target_workspace_id,
    target_run_id,
    target_authorization_snapshot_ref
  );

  if target_request_count is null
     or target_request_count < 0
     or target_graph_expansion_count is null
     or target_graph_expansion_count < 0
     or target_provider_failure_count is null
     or target_provider_failure_count < 0
     or target_started_at is null
     or target_deadline_at is null
     or target_deadline_at <= target_started_at then
    raise exception 'PENTEST_COVERAGE_INVALID';
  end if;

  insert into public.pentest_coverage (
    run_id,
    workspace_id,
    authorization_snapshot_ref,
    attempted_capability_ids,
    covered_node_ids,
    untested_node_ids,
    request_count,
    graph_expansion_count,
    provider_failure_count,
    started_at,
    deadline_at
  )
  values (
    target_run_id,
    target_workspace_id,
    target_authorization_snapshot_ref,
    coalesce(target_attempted_capability_ids, '{}'::text[]),
    coalesce(target_covered_node_ids, '{}'::text[]),
    coalesce(target_untested_node_ids, '{}'::text[]),
    target_request_count,
    target_graph_expansion_count,
    target_provider_failure_count,
    target_started_at,
    target_deadline_at
  )
  on conflict (run_id) do update
    set workspace_id = excluded.workspace_id,
        authorization_snapshot_ref = excluded.authorization_snapshot_ref,
        attempted_capability_ids = excluded.attempted_capability_ids,
        covered_node_ids = excluded.covered_node_ids,
        untested_node_ids = excluded.untested_node_ids,
        request_count = excluded.request_count,
        graph_expansion_count = excluded.graph_expansion_count,
        provider_failure_count = excluded.provider_failure_count,
        started_at = excluded.started_at,
        deadline_at = excluded.deadline_at;

  return jsonb_build_object('runId', target_run_id);
end;
$$;

revoke all on function public.upsert_pentest_coverage(
  uuid, uuid, text, text[], text[], text[], integer, integer, integer, timestamptz, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.upsert_pentest_coverage(
  uuid, uuid, text, text[], text[], text[], integer, integer, integer, timestamptz, timestamptz
) to service_role;

create or replace function public.append_pentest_run_event(
  target_workspace_id uuid,
  target_run_id uuid,
  target_authorization_snapshot_ref text,
  target_event_type text,
  target_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_id uuid;
begin
  perform private.assert_pentest_run_binding(
    target_workspace_id,
    target_run_id,
    target_authorization_snapshot_ref
  );

  if target_event_type is null
     or char_length(target_event_type) not between 1 and 100
     or target_event_type !~ '^[A-Z0-9_]+$'
     or target_metadata is null
     or jsonb_typeof(target_metadata) <> 'object'
     or pg_column_size(target_metadata) > 8192 then
    raise exception 'PENTEST_RUN_EVENT_INVALID';
  end if;

  insert into public.pentest_run_events (
    workspace_id,
    run_id,
    authorization_snapshot_ref,
    event_type,
    metadata
  )
  values (
    target_workspace_id,
    target_run_id,
    target_authorization_snapshot_ref,
    target_event_type,
    target_metadata
  )
  returning id into event_id;

  return event_id;
end;
$$;

revoke all on function public.append_pentest_run_event(
  uuid, uuid, text, text, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.append_pentest_run_event(
  uuid, uuid, text, text, jsonb
) to service_role;
