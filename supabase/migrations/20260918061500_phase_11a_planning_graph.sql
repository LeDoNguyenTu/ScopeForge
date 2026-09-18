-- Phase 11A planning persistence foundation.
-- Forward-only. Implementation code does not authorize production application.

create table private.pentest_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  root_asset_id uuid not null,
  authorization_snapshot_ref text not null,
  policy_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'created'
    check (status in ('created', 'running', 'waiting_approval', 'completed', 'cancelled', 'failed')),
  stop_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  constraint pentest_runs_root_asset_workspace_fkey
    foreign key (root_asset_id, workspace_id)
    references public.assets(id, workspace_id)
    on delete cascade,
  check (char_length(authorization_snapshot_ref) between 1 and 512),
  check (octet_length(policy_snapshot::text) <= 65536)
);

create index pentest_runs_workspace_created_idx
  on private.pentest_runs(workspace_id, created_at desc);
create index pentest_runs_root_asset_workspace_idx
  on private.pentest_runs(root_asset_id, workspace_id);

create table private.pentest_graph_nodes (
  workspace_id uuid not null,
  run_id uuid not null,
  node_id text not null,
  asset_type text not null
    check (asset_type in (
      'repository', 'domain', 'hostname', 'ip_endpoint', 'http_service', 'api',
      'api_operation', 'cloud_account', 'cloud_resource', 'container_image',
      'kubernetes_workload', 'mobile_application', 'identity'
    )),
  canonical_locator text not null,
  parent_node_ids text[] not null default '{}',
  authorization_ref text not null,
  technology_tags text[] not null default '{}',
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  provenance_refs text[] not null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, run_id, node_id),
  constraint pentest_graph_nodes_run_fkey
    foreign key (run_id, workspace_id)
    references private.pentest_runs(id, workspace_id)
    on delete cascade,
  check (char_length(node_id) between 1 and 512),
  check (char_length(canonical_locator) between 1 and 4096),
  check (char_length(authorization_ref) between 1 and 512),
  check (cardinality(provenance_refs) between 1 and 256),
  check (cardinality(parent_node_ids) <= 256),
  check (cardinality(technology_tags) <= 128)
);

create index pentest_graph_nodes_run_idx
  on private.pentest_graph_nodes(run_id, workspace_id);

create table private.pentest_graph_edges (
  workspace_id uuid not null,
  run_id uuid not null,
  edge_id text not null,
  from_node_id text not null,
  to_node_id text not null,
  relationship text not null
    check (relationship in (
      'exposes', 'depends_on', 'authenticates_to', 'trusts', 'deploys_to',
      'contains', 'reachable_from', 'affected_by', 'enables'
    )),
  provenance_kind text not null
    check (provenance_kind in ('observed', 'scanner-derived', 'user-confirmed')),
  provenance_refs text[] not null,
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  observed_at timestamptz not null,
  authorization_ref text not null,
  stale boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, run_id, edge_id),
  constraint pentest_graph_edges_run_fkey
    foreign key (run_id, workspace_id)
    references private.pentest_runs(id, workspace_id)
    on delete cascade,
  constraint pentest_graph_edges_from_node_fkey
    foreign key (workspace_id, run_id, from_node_id)
    references private.pentest_graph_nodes(workspace_id, run_id, node_id)
    on delete cascade,
  constraint pentest_graph_edges_to_node_fkey
    foreign key (workspace_id, run_id, to_node_id)
    references private.pentest_graph_nodes(workspace_id, run_id, node_id)
    on delete cascade,
  check (char_length(edge_id) between 1 and 1024),
  check (from_node_id <> to_node_id),
  check (cardinality(provenance_refs) between 1 and 256),
  check (char_length(authorization_ref) between 1 and 512)
);

create index pentest_graph_edges_run_idx
  on private.pentest_graph_edges(run_id, workspace_id);
create index pentest_graph_edges_from_node_idx
  on private.pentest_graph_edges(workspace_id, run_id, from_node_id);
create index pentest_graph_edges_to_node_idx
  on private.pentest_graph_edges(workspace_id, run_id, to_node_id);

create table private.pentest_observations (
  workspace_id uuid not null,
  run_id uuid not null,
  observation_id text not null,
  provider_id text not null,
  provider_version text not null,
  capability_id text not null,
  asset_node_ids text[] not null,
  evidence_refs text[] not null,
  facts jsonb not null,
  observed_at timestamptz not null,
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  authorization_snapshot_ref text not null,
  execution_mode text not null
    check (execution_mode in ('passive', 'safe_active', 'intrusive', 'validation')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, run_id, observation_id),
  constraint pentest_observations_run_fkey
    foreign key (run_id, workspace_id)
    references private.pentest_runs(id, workspace_id)
    on delete cascade,
  check (char_length(observation_id) between 1 and 1024),
  check (char_length(provider_id) between 1 and 256),
  check (char_length(provider_version) between 1 and 256),
  check (char_length(capability_id) between 1 and 256),
  check (cardinality(asset_node_ids) between 1 and 256),
  check (cardinality(evidence_refs) between 1 and 256),
  check (octet_length(facts::text) <= 65536),
  check (char_length(authorization_snapshot_ref) between 1 and 512)
);

create index pentest_observations_run_observed_idx
  on private.pentest_observations(run_id, workspace_id, observed_at desc);

create table private.pentest_hypotheses (
  workspace_id uuid not null,
  run_id uuid not null,
  hypothesis_id text not null,
  reasoning_source text not null,
  target_node_ids text[] not null,
  statement text not null,
  preconditions text[] not null default '{}',
  candidate_capability_ids text[] not null,
  expected_evidence_types text[] not null,
  base_confidence double precision not null check (base_confidence >= 0 and base_confidence <= 1),
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  status text not null
    check (status in ('proposed', 'eligible', 'blocked', 'testing', 'supported', 'refuted', 'exhausted')),
  evidence_refs text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (workspace_id, run_id, hypothesis_id),
  constraint pentest_hypotheses_run_fkey
    foreign key (run_id, workspace_id)
    references private.pentest_runs(id, workspace_id)
    on delete cascade,
  check (char_length(hypothesis_id) between 1 and 1024),
  check (char_length(reasoning_source) between 1 and 512),
  check (char_length(statement) between 1 and 8192),
  check (cardinality(target_node_ids) between 1 and 256),
  check (cardinality(candidate_capability_ids) between 1 and 64),
  check (cardinality(expected_evidence_types) between 1 and 128),
  check (cardinality(evidence_refs) <= 256)
);

create index pentest_hypotheses_run_status_idx
  on private.pentest_hypotheses(run_id, workspace_id, status);

create table private.pentest_coverage (
  workspace_id uuid not null,
  run_id uuid not null,
  attempted_capability_ids text[] not null default '{}',
  covered_node_ids text[] not null default '{}',
  untested_node_ids text[] not null default '{}',
  request_count integer not null default 0 check (request_count >= 0),
  graph_expansion_count integer not null default 0 check (graph_expansion_count >= 0),
  provider_failure_count integer not null default 0 check (provider_failure_count >= 0),
  started_at timestamptz not null,
  deadline_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, run_id),
  constraint pentest_coverage_run_fkey
    foreign key (run_id, workspace_id)
    references private.pentest_runs(id, workspace_id)
    on delete cascade,
  check (deadline_at > started_at),
  check (cardinality(attempted_capability_ids) <= 512),
  check (cardinality(covered_node_ids) <= 4096),
  check (cardinality(untested_node_ids) <= 4096)
);

create index pentest_coverage_run_idx
  on private.pentest_coverage(run_id, workspace_id);

create table private.pentest_run_events (
  id uuid primary key,
  workspace_id uuid not null,
  run_id uuid not null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  constraint pentest_run_events_run_fkey
    foreign key (run_id, workspace_id)
    references private.pentest_runs(id, workspace_id)
    on delete cascade,
  check (char_length(event_type) between 1 and 128),
  check (octet_length(metadata::text) <= 8192)
);

create index pentest_run_events_run_created_idx
  on private.pentest_run_events(run_id, workspace_id, created_at desc);

alter table private.pentest_runs enable row level security;
alter table private.pentest_graph_nodes enable row level security;
alter table private.pentest_graph_edges enable row level security;
alter table private.pentest_observations enable row level security;
alter table private.pentest_hypotheses enable row level security;
alter table private.pentest_coverage enable row level security;
alter table private.pentest_run_events enable row level security;

revoke all on table private.pentest_runs from public, anon, authenticated, service_role;
revoke all on table private.pentest_graph_nodes from public, anon, authenticated, service_role;
revoke all on table private.pentest_graph_edges from public, anon, authenticated, service_role;
revoke all on table private.pentest_observations from public, anon, authenticated, service_role;
revoke all on table private.pentest_hypotheses from public, anon, authenticated, service_role;
revoke all on table private.pentest_coverage from public, anon, authenticated, service_role;
revoke all on table private.pentest_run_events from public, anon, authenticated, service_role;

create table public.pentest_run_summaries (
  run_id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  root_asset_id uuid not null,
  status text not null,
  stop_reason text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (run_id, workspace_id),
  constraint pentest_run_summaries_root_asset_workspace_fkey
    foreign key (root_asset_id, workspace_id)
    references public.assets(id, workspace_id)
    on delete cascade
);

create index pentest_run_summaries_workspace_updated_idx
  on public.pentest_run_summaries(workspace_id, updated_at desc);
create index pentest_run_summaries_root_asset_workspace_idx
  on public.pentest_run_summaries(root_asset_id, workspace_id);

create table public.pentest_graph_node_summaries (
  workspace_id uuid not null,
  run_id uuid not null,
  node_id text not null,
  asset_type text not null,
  parent_node_ids text[] not null default '{}',
  technology_tags text[] not null default '{}',
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  updated_at timestamptz not null,
  primary key (workspace_id, run_id, node_id),
  constraint pentest_graph_node_summaries_run_fkey
    foreign key (run_id, workspace_id)
    references public.pentest_run_summaries(run_id, workspace_id)
    on delete cascade
);

create index pentest_graph_node_summaries_run_idx
  on public.pentest_graph_node_summaries(run_id, workspace_id);

create table public.pentest_graph_edge_summaries (
  workspace_id uuid not null,
  run_id uuid not null,
  edge_id text not null,
  from_node_id text not null,
  to_node_id text not null,
  relationship text not null,
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  stale boolean not null,
  updated_at timestamptz not null,
  primary key (workspace_id, run_id, edge_id),
  constraint pentest_graph_edge_summaries_run_fkey
    foreign key (run_id, workspace_id)
    references public.pentest_run_summaries(run_id, workspace_id)
    on delete cascade
);

create index pentest_graph_edge_summaries_run_idx
  on public.pentest_graph_edge_summaries(run_id, workspace_id);
create index pentest_graph_edge_summaries_from_idx
  on public.pentest_graph_edge_summaries(workspace_id, run_id, from_node_id);
create index pentest_graph_edge_summaries_to_idx
  on public.pentest_graph_edge_summaries(workspace_id, run_id, to_node_id);

create table public.pentest_observation_summaries (
  workspace_id uuid not null,
  run_id uuid not null,
  observation_id text not null,
  provider_id text not null,
  provider_version text not null,
  capability_id text not null,
  asset_node_ids text[] not null,
  execution_mode text not null,
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  observed_at timestamptz not null,
  primary key (workspace_id, run_id, observation_id),
  constraint pentest_observation_summaries_run_fkey
    foreign key (run_id, workspace_id)
    references public.pentest_run_summaries(run_id, workspace_id)
    on delete cascade
);

create index pentest_observation_summaries_run_observed_idx
  on public.pentest_observation_summaries(run_id, workspace_id, observed_at desc);

create table public.pentest_hypothesis_summaries (
  workspace_id uuid not null,
  run_id uuid not null,
  hypothesis_id text not null,
  target_node_ids text[] not null,
  candidate_capability_ids text[] not null,
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  status text not null,
  updated_at timestamptz not null,
  primary key (workspace_id, run_id, hypothesis_id),
  constraint pentest_hypothesis_summaries_run_fkey
    foreign key (run_id, workspace_id)
    references public.pentest_run_summaries(run_id, workspace_id)
    on delete cascade
);

create index pentest_hypothesis_summaries_run_status_idx
  on public.pentest_hypothesis_summaries(run_id, workspace_id, status);

create table public.pentest_coverage_summaries (
  workspace_id uuid not null,
  run_id uuid not null,
  attempted_capability_count integer not null check (attempted_capability_count >= 0),
  covered_node_count integer not null check (covered_node_count >= 0),
  untested_node_count integer not null check (untested_node_count >= 0),
  request_count integer not null check (request_count >= 0),
  graph_expansion_count integer not null check (graph_expansion_count >= 0),
  provider_failure_count integer not null check (provider_failure_count >= 0),
  started_at timestamptz not null,
  deadline_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (workspace_id, run_id),
  constraint pentest_coverage_summaries_run_fkey
    foreign key (run_id, workspace_id)
    references public.pentest_run_summaries(run_id, workspace_id)
    on delete cascade
);

alter table public.pentest_run_summaries enable row level security;
alter table public.pentest_graph_node_summaries enable row level security;
alter table public.pentest_graph_edge_summaries enable row level security;
alter table public.pentest_observation_summaries enable row level security;
alter table public.pentest_hypothesis_summaries enable row level security;
alter table public.pentest_coverage_summaries enable row level security;

create policy pentest_run_summaries_select_member
  on public.pentest_run_summaries for select
  to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy pentest_graph_node_summaries_select_member
  on public.pentest_graph_node_summaries for select
  to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy pentest_graph_edge_summaries_select_member
  on public.pentest_graph_edge_summaries for select
  to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy pentest_observation_summaries_select_member
  on public.pentest_observation_summaries for select
  to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy pentest_hypothesis_summaries_select_member
  on public.pentest_hypothesis_summaries for select
  to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy pentest_coverage_summaries_select_member
  on public.pentest_coverage_summaries for select
  to authenticated
  using ((select private.is_workspace_member(workspace_id)));

revoke all on table public.pentest_run_summaries from public, anon, authenticated, service_role;
revoke all on table public.pentest_graph_node_summaries from public, anon, authenticated, service_role;
revoke all on table public.pentest_graph_edge_summaries from public, anon, authenticated, service_role;
revoke all on table public.pentest_observation_summaries from public, anon, authenticated, service_role;
revoke all on table public.pentest_hypothesis_summaries from public, anon, authenticated, service_role;
revoke all on table public.pentest_coverage_summaries from public, anon, authenticated, service_role;

grant select on table public.pentest_run_summaries to authenticated;
grant select on table public.pentest_graph_node_summaries to authenticated;
grant select on table public.pentest_graph_edge_summaries to authenticated;
grant select on table public.pentest_observation_summaries to authenticated;
grant select on table public.pentest_hypothesis_summaries to authenticated;
grant select on table public.pentest_coverage_summaries to authenticated;

create or replace function public.persist_phase11_graph_state(
  target_workspace_id uuid,
  target_run_id uuid,
  target_authorization_snapshot_ref text,
  node_rows jsonb,
  edge_rows jsonb,
  hypothesis_rows jsonb,
  coverage_row jsonb,
  event_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_record private.pentest_runs%rowtype;
  node_row jsonb;
  edge_row jsonb;
  hypothesis_row jsonb;
  event_row jsonb;
  coverage_object jsonb;
  node_count integer;
  edge_count integer;
  hypothesis_count integer;
  event_count integer;
begin
  if node_rows is null
    or edge_rows is null
    or hypothesis_rows is null
    or coverage_row is null
    or event_rows is null
    or jsonb_typeof(node_rows) <> 'array'
    or jsonb_typeof(edge_rows) <> 'array'
    or jsonb_typeof(hypothesis_rows) <> 'array'
    or jsonb_typeof(coverage_row) <> 'object'
    or jsonb_typeof(event_rows) <> 'array'
  then
    raise exception 'PHASE11_GRAPH_PAYLOAD_INVALID';
  end if;

  node_count := jsonb_array_length(node_rows);
  edge_count := jsonb_array_length(edge_rows);
  hypothesis_count := jsonb_array_length(hypothesis_rows);
  event_count := jsonb_array_length(event_rows);

  if node_count > 1000 or edge_count > 2000 or hypothesis_count > 1000 or event_count > 500 then
    raise exception 'PHASE11_GRAPH_PAYLOAD_TOO_LARGE';
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
  if run_record.authorization_snapshot_ref is distinct from target_authorization_snapshot_ref then
    raise exception 'PHASE11_AUTHORIZATION_SNAPSHOT_MISMATCH';
  end if;
  if run_record.status in ('completed', 'cancelled', 'failed') then
    raise exception 'PHASE11_RUN_TERMINAL';
  end if;

  for node_row in select value from jsonb_array_elements(node_rows)
  loop
    if coalesce(node_row->>'node_id', '') = ''
      or coalesce(node_row->>'asset_type', '') = ''
      or coalesce(node_row->>'canonical_locator', '') = ''
      or coalesce(node_row->>'authorization_ref', '') = ''
      or node_row->>'authorization_ref' <> target_authorization_snapshot_ref
      or jsonb_typeof(node_row->'parent_node_ids') <> 'array'
      or jsonb_typeof(node_row->'technology_tags') <> 'array'
      or jsonb_typeof(node_row->'provenance_refs') <> 'array'
      or jsonb_array_length(node_row->'provenance_refs') = 0
      or coalesce((node_row->>'confidence')::double precision, -1) < 0
      or coalesce((node_row->>'confidence')::double precision, 2) > 1
    then
      raise exception 'PHASE11_GRAPH_NODE_INVALID';
    end if;

    insert into private.pentest_graph_nodes (
      workspace_id, run_id, node_id, asset_type, canonical_locator,
      parent_node_ids, authorization_ref, technology_tags, confidence,
      provenance_refs, updated_at
    )
    values (
      target_workspace_id,
      target_run_id,
      node_row->>'node_id',
      node_row->>'asset_type',
      node_row->>'canonical_locator',
      array(select jsonb_array_elements_text(node_row->'parent_node_ids')),
      node_row->>'authorization_ref',
      array(select jsonb_array_elements_text(node_row->'technology_tags')),
      (node_row->>'confidence')::double precision,
      array(select jsonb_array_elements_text(node_row->'provenance_refs')),
      now()
    )
    on conflict (workspace_id, run_id, node_id) do update
    set asset_type = excluded.asset_type,
        canonical_locator = excluded.canonical_locator,
        parent_node_ids = excluded.parent_node_ids,
        authorization_ref = excluded.authorization_ref,
        technology_tags = excluded.technology_tags,
        confidence = excluded.confidence,
        provenance_refs = excluded.provenance_refs,
        updated_at = excluded.updated_at;

    insert into public.pentest_graph_node_summaries (
      workspace_id, run_id, node_id, asset_type, parent_node_ids,
      technology_tags, confidence, updated_at
    )
    values (
      target_workspace_id,
      target_run_id,
      node_row->>'node_id',
      node_row->>'asset_type',
      array(select jsonb_array_elements_text(node_row->'parent_node_ids')),
      array(select jsonb_array_elements_text(node_row->'technology_tags')),
      (node_row->>'confidence')::double precision,
      now()
    )
    on conflict (workspace_id, run_id, node_id) do update
    set asset_type = excluded.asset_type,
        parent_node_ids = excluded.parent_node_ids,
        technology_tags = excluded.technology_tags,
        confidence = excluded.confidence,
        updated_at = excluded.updated_at;
  end loop;

  for edge_row in select value from jsonb_array_elements(edge_rows)
  loop
    if coalesce(edge_row->>'edge_id', '') = ''
      or coalesce(edge_row->>'from_node_id', '') = ''
      or coalesce(edge_row->>'to_node_id', '') = ''
      or coalesce(edge_row->>'relationship', '') = ''
      or coalesce(edge_row->>'provenance_kind', '') = ''
      or jsonb_typeof(edge_row->'provenance_refs') <> 'array'
      or jsonb_array_length(edge_row->'provenance_refs') = 0
      or coalesce(edge_row->>'authorization_ref', '') = ''
      or edge_row->>'authorization_ref' <> target_authorization_snapshot_ref
    then
      raise exception 'PHASE11_GRAPH_EDGE_INVALID';
    end if;

    insert into private.pentest_graph_edges (
      workspace_id, run_id, edge_id, from_node_id, to_node_id,
      relationship, provenance_kind, provenance_refs, confidence,
      observed_at, authorization_ref, stale, updated_at
    )
    values (
      target_workspace_id,
      target_run_id,
      edge_row->>'edge_id',
      edge_row->>'from_node_id',
      edge_row->>'to_node_id',
      edge_row->>'relationship',
      edge_row->>'provenance_kind',
      array(select jsonb_array_elements_text(edge_row->'provenance_refs')),
      (edge_row->>'confidence')::double precision,
      (edge_row->>'observed_at')::timestamptz,
      edge_row->>'authorization_ref',
      (edge_row->>'stale')::boolean,
      now()
    )
    on conflict (workspace_id, run_id, edge_id) do update
    set from_node_id = excluded.from_node_id,
        to_node_id = excluded.to_node_id,
        relationship = excluded.relationship,
        provenance_kind = excluded.provenance_kind,
        provenance_refs = excluded.provenance_refs,
        confidence = excluded.confidence,
        observed_at = excluded.observed_at,
        authorization_ref = excluded.authorization_ref,
        stale = excluded.stale,
        updated_at = excluded.updated_at;

    insert into public.pentest_graph_edge_summaries (
      workspace_id, run_id, edge_id, from_node_id, to_node_id,
      relationship, confidence, stale, updated_at
    )
    values (
      target_workspace_id,
      target_run_id,
      edge_row->>'edge_id',
      edge_row->>'from_node_id',
      edge_row->>'to_node_id',
      edge_row->>'relationship',
      (edge_row->>'confidence')::double precision,
      (edge_row->>'stale')::boolean,
      now()
    )
    on conflict (workspace_id, run_id, edge_id) do update
    set from_node_id = excluded.from_node_id,
        to_node_id = excluded.to_node_id,
        relationship = excluded.relationship,
        confidence = excluded.confidence,
        stale = excluded.stale,
        updated_at = excluded.updated_at;
  end loop;

  for hypothesis_row in select value from jsonb_array_elements(hypothesis_rows)
  loop
    if coalesce(hypothesis_row->>'hypothesis_id', '') = ''
      or coalesce(hypothesis_row->>'reasoning_source', '') = ''
      or coalesce(hypothesis_row->>'statement', '') = ''
      or jsonb_typeof(hypothesis_row->'target_node_ids') <> 'array'
      or jsonb_array_length(hypothesis_row->'target_node_ids') = 0
      or jsonb_typeof(hypothesis_row->'candidate_capability_ids') <> 'array'
      or jsonb_array_length(hypothesis_row->'candidate_capability_ids') = 0
      or jsonb_typeof(hypothesis_row->'expected_evidence_types') <> 'array'
      or jsonb_array_length(hypothesis_row->'expected_evidence_types') = 0
    then
      raise exception 'PHASE11_HYPOTHESIS_INVALID';
    end if;

    if exists (
      select 1
      from jsonb_array_elements_text(hypothesis_row->'target_node_ids') target_node_id
      where not exists (
        select 1
        from private.pentest_graph_nodes graph_node
        where graph_node.workspace_id = target_workspace_id
          and graph_node.run_id = target_run_id
          and graph_node.node_id = target_node_id
      )
    ) then
      raise exception 'PHASE11_HYPOTHESIS_TARGET_UNKNOWN';
    end if;

    insert into private.pentest_hypotheses (
      workspace_id, run_id, hypothesis_id, reasoning_source,
      target_node_ids, statement, preconditions, candidate_capability_ids,
      expected_evidence_types, base_confidence, confidence, status,
      evidence_refs, updated_at
    )
    values (
      target_workspace_id,
      target_run_id,
      hypothesis_row->>'hypothesis_id',
      hypothesis_row->>'reasoning_source',
      array(select jsonb_array_elements_text(hypothesis_row->'target_node_ids')),
      hypothesis_row->>'statement',
      array(select jsonb_array_elements_text(coalesce(hypothesis_row->'preconditions', '[]'::jsonb))),
      array(select jsonb_array_elements_text(hypothesis_row->'candidate_capability_ids')),
      array(select jsonb_array_elements_text(hypothesis_row->'expected_evidence_types')),
      (hypothesis_row->>'base_confidence')::double precision,
      (hypothesis_row->>'confidence')::double precision,
      hypothesis_row->>'status',
      array(select jsonb_array_elements_text(coalesce(hypothesis_row->'evidence_refs', '[]'::jsonb))),
      now()
    )
    on conflict (workspace_id, run_id, hypothesis_id) do update
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
        updated_at = excluded.updated_at;

    insert into public.pentest_hypothesis_summaries (
      workspace_id, run_id, hypothesis_id, target_node_ids,
      candidate_capability_ids, confidence, status, updated_at
    )
    values (
      target_workspace_id,
      target_run_id,
      hypothesis_row->>'hypothesis_id',
      array(select jsonb_array_elements_text(hypothesis_row->'target_node_ids')),
      array(select jsonb_array_elements_text(hypothesis_row->'candidate_capability_ids')),
      (hypothesis_row->>'confidence')::double precision,
      hypothesis_row->>'status',
      now()
    )
    on conflict (workspace_id, run_id, hypothesis_id) do update
    set target_node_ids = excluded.target_node_ids,
        candidate_capability_ids = excluded.candidate_capability_ids,
        confidence = excluded.confidence,
        status = excluded.status,
        updated_at = excluded.updated_at;
  end loop;

  coverage_object := coverage_row;
  insert into private.pentest_coverage (
    workspace_id, run_id, attempted_capability_ids, covered_node_ids,
    untested_node_ids, request_count, graph_expansion_count,
    provider_failure_count, started_at, deadline_at, updated_at
  )
  values (
    target_workspace_id,
    target_run_id,
    array(select jsonb_array_elements_text(coalesce(coverage_object->'attempted_capability_ids', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(coverage_object->'covered_node_ids', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(coverage_object->'untested_node_ids', '[]'::jsonb))),
    coalesce((coverage_object->>'request_count')::integer, 0),
    coalesce((coverage_object->>'graph_expansion_count')::integer, 0),
    coalesce((coverage_object->>'provider_failure_count')::integer, 0),
    (coverage_object->>'started_at')::timestamptz,
    (coverage_object->>'deadline_at')::timestamptz,
    now()
  )
  on conflict (workspace_id, run_id) do update
  set attempted_capability_ids = excluded.attempted_capability_ids,
      covered_node_ids = excluded.covered_node_ids,
      untested_node_ids = excluded.untested_node_ids,
      request_count = excluded.request_count,
      graph_expansion_count = excluded.graph_expansion_count,
      provider_failure_count = excluded.provider_failure_count,
      started_at = excluded.started_at,
      deadline_at = excluded.deadline_at,
      updated_at = excluded.updated_at;

  insert into public.pentest_coverage_summaries (
    workspace_id, run_id, attempted_capability_count, covered_node_count,
    untested_node_count, request_count, graph_expansion_count,
    provider_failure_count, started_at, deadline_at, updated_at
  )
  values (
    target_workspace_id,
    target_run_id,
    jsonb_array_length(coalesce(coverage_object->'attempted_capability_ids', '[]'::jsonb)),
    jsonb_array_length(coalesce(coverage_object->'covered_node_ids', '[]'::jsonb)),
    jsonb_array_length(coalesce(coverage_object->'untested_node_ids', '[]'::jsonb)),
    coalesce((coverage_object->>'request_count')::integer, 0),
    coalesce((coverage_object->>'graph_expansion_count')::integer, 0),
    coalesce((coverage_object->>'provider_failure_count')::integer, 0),
    (coverage_object->>'started_at')::timestamptz,
    (coverage_object->>'deadline_at')::timestamptz,
    now()
  )
  on conflict (workspace_id, run_id) do update
  set attempted_capability_count = excluded.attempted_capability_count,
      covered_node_count = excluded.covered_node_count,
      untested_node_count = excluded.untested_node_count,
      request_count = excluded.request_count,
      graph_expansion_count = excluded.graph_expansion_count,
      provider_failure_count = excluded.provider_failure_count,
      started_at = excluded.started_at,
      deadline_at = excluded.deadline_at,
      updated_at = excluded.updated_at;

  for event_row in select value from jsonb_array_elements(event_rows)
  loop
    if coalesce(event_row->>'id', '') = ''
      or coalesce(event_row->>'event_type', '') = ''
      or jsonb_typeof(coalesce(event_row->'metadata', '{}'::jsonb)) <> 'object'
    then
      raise exception 'PHASE11_RUN_EVENT_INVALID';
    end if;

    insert into private.pentest_run_events (
      id, workspace_id, run_id, event_type, metadata, created_at
    )
    values (
      (event_row->>'id')::uuid,
      target_workspace_id,
      target_run_id,
      event_row->>'event_type',
      coalesce(event_row->'metadata', '{}'::jsonb),
      (event_row->>'created_at')::timestamptz
    )
    on conflict (id) do nothing;
  end loop;

  update private.pentest_runs
  set updated_at = now()
  where id = target_run_id and workspace_id = target_workspace_id;

  update public.pentest_run_summaries
  set updated_at = now()
  where run_id = target_run_id and workspace_id = target_workspace_id;

  return jsonb_build_object(
    'nodeCount', node_count,
    'edgeCount', edge_count,
    'hypothesisCount', hypothesis_count,
    'eventCount', event_count
  );
end;
$$;

create or replace function public.persist_phase11_observations(
  target_workspace_id uuid,
  target_run_id uuid,
  target_authorization_snapshot_ref text,
  observation_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_record private.pentest_runs%rowtype;
  observation_row jsonb;
  existing_record private.pentest_observations%rowtype;
  inserted_count integer := 0;
  replayed_count integer := 0;
  inserted_rows integer;
begin
  if observation_rows is null
    or jsonb_typeof(observation_rows) <> 'array'
    or jsonb_array_length(observation_rows) > 2000
  then
    raise exception 'PHASE11_OBSERVATION_PAYLOAD_INVALID';
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
  if run_record.authorization_snapshot_ref is distinct from target_authorization_snapshot_ref then
    raise exception 'PHASE11_AUTHORIZATION_SNAPSHOT_MISMATCH';
  end if;
  if run_record.status in ('completed', 'cancelled', 'failed') then
    raise exception 'PHASE11_RUN_TERMINAL';
  end if;

  for observation_row in select value from jsonb_array_elements(observation_rows)
  loop
    if coalesce(observation_row->>'observation_id', '') = ''
      or coalesce(observation_row->>'provider_id', '') = ''
      or coalesce(observation_row->>'provider_version', '') = ''
      or coalesce(observation_row->>'capability_id', '') = ''
      or jsonb_typeof(observation_row->'asset_node_ids') <> 'array'
      or jsonb_array_length(observation_row->'asset_node_ids') = 0
      or jsonb_typeof(observation_row->'evidence_refs') <> 'array'
      or jsonb_array_length(observation_row->'evidence_refs') = 0
      or jsonb_typeof(observation_row->'facts') <> 'object'
      or exists (
        select 1
        from jsonb_each(observation_row->'facts') fact
        where jsonb_typeof(fact.value) not in ('string', 'number', 'boolean')
      )
      or coalesce(observation_row->>'authorization_snapshot_ref', '') <> target_authorization_snapshot_ref
    then
      raise exception 'PHASE11_OBSERVATION_INVALID';
    end if;

    if exists (
      select 1
      from jsonb_array_elements_text(observation_row->'asset_node_ids') target_node_id
      where not exists (
        select 1
        from private.pentest_graph_nodes graph_node
        where graph_node.workspace_id = target_workspace_id
          and graph_node.run_id = target_run_id
          and graph_node.node_id = target_node_id
      )
    ) then
      raise exception 'PHASE11_OBSERVATION_TARGET_UNKNOWN';
    end if;

    insert into private.pentest_observations (
      workspace_id, run_id, observation_id, provider_id, provider_version,
      capability_id, asset_node_ids, evidence_refs, facts, observed_at,
      confidence, authorization_snapshot_ref, execution_mode
    )
    values (
      target_workspace_id,
      target_run_id,
      observation_row->>'observation_id',
      observation_row->>'provider_id',
      observation_row->>'provider_version',
      observation_row->>'capability_id',
      array(select jsonb_array_elements_text(observation_row->'asset_node_ids')),
      array(select jsonb_array_elements_text(observation_row->'evidence_refs')),
      observation_row->'facts',
      (observation_row->>'observed_at')::timestamptz,
      (observation_row->>'confidence')::double precision,
      observation_row->>'authorization_snapshot_ref',
      observation_row->>'execution_mode'
    )
    on conflict (workspace_id, run_id, observation_id) do nothing;

    get diagnostics inserted_rows = row_count;
    if inserted_rows = 0 then
      select *
      into existing_record
      from private.pentest_observations
      where workspace_id = target_workspace_id
        and run_id = target_run_id
        and observation_id = observation_row->>'observation_id';

      if existing_record.provider_id is distinct from observation_row->>'provider_id'
        or existing_record.provider_version is distinct from observation_row->>'provider_version'
        or existing_record.capability_id is distinct from observation_row->>'capability_id'
        or existing_record.asset_node_ids is distinct from array(select jsonb_array_elements_text(observation_row->'asset_node_ids'))
        or existing_record.evidence_refs is distinct from array(select jsonb_array_elements_text(observation_row->'evidence_refs'))
        or existing_record.facts is distinct from observation_row->'facts'
        or existing_record.observed_at is distinct from (observation_row->>'observed_at')::timestamptz
        or existing_record.confidence is distinct from (observation_row->>'confidence')::double precision
        or existing_record.authorization_snapshot_ref is distinct from observation_row->>'authorization_snapshot_ref'
        or existing_record.execution_mode is distinct from observation_row->>'execution_mode'
      then
        raise exception 'PHASE11_OBSERVATION_IDENTITY_CONFLICT';
      end if;
      replayed_count := replayed_count + 1;
    else
      inserted_count := inserted_count + 1;

      insert into public.pentest_observation_summaries (
        workspace_id, run_id, observation_id, provider_id, provider_version,
        capability_id, asset_node_ids, execution_mode, confidence, observed_at
      )
      values (
        target_workspace_id,
        target_run_id,
        observation_row->>'observation_id',
        observation_row->>'provider_id',
        observation_row->>'provider_version',
        observation_row->>'capability_id',
        array(select jsonb_array_elements_text(observation_row->'asset_node_ids')),
        observation_row->>'execution_mode',
        (observation_row->>'confidence')::double precision,
        (observation_row->>'observed_at')::timestamptz
      )
      on conflict (workspace_id, run_id, observation_id) do nothing;
    end if;
  end loop;

  update private.pentest_runs
  set updated_at = now()
  where id = target_run_id and workspace_id = target_workspace_id;

  update public.pentest_run_summaries
  set updated_at = now()
  where run_id = target_run_id and workspace_id = target_workspace_id;

  return jsonb_build_object(
    'insertedCount', inserted_count,
    'replayedCount', replayed_count
  );
end;
$$;

revoke all on function public.persist_phase11_graph_state(
  uuid, uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.persist_phase11_graph_state(
  uuid, uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb
) to service_role;

revoke all on function public.persist_phase11_observations(
  uuid, uuid, text, jsonb
) from public, anon, authenticated;
grant execute on function public.persist_phase11_observations(
  uuid, uuid, text, jsonb
) to service_role;
