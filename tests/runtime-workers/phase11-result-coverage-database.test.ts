// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260919020000_phase_11c_result_coverage_reconciliation.sql";

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema private;
    create schema extensions;

    create table private.pentest_actions (
      workspace_id uuid,
      run_id uuid,
      action_id text,
      decision_status text,
      max_requests integer,
      capability_id text,
      capability_version text,
      target_node_ids text[],
      state text,
      authorization_id text,
      authorization_snapshot_ref text,
      requested_mode text,
      closed_parameters jsonb,
      authorization_expires_at timestamptz,
      updated_at timestamptz
    );

    create table private.pentest_coverage (
      workspace_id uuid,
      run_id uuid,
      attempted_capability_ids text[] not null default '{}',
      covered_node_ids text[] not null default '{}',
      untested_node_ids text[] not null default '{}',
      request_count integer not null default 0,
      graph_expansion_count integer not null default 0,
      provider_failure_count integer not null default 0,
      started_at timestamptz not null default now(),
      deadline_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table private.pentest_action_attempts (
      id uuid,
      workspace_id uuid,
      run_id uuid,
      action_id text,
      authorization_id text,
      provider_id text,
      provider_version text,
      status text,
      observation_ids text[],
      evidence_refs text[],
      started_at timestamptz,
      completed_at timestamptz,
      error_code text
    );

    create table private.worker_nodes (
      id uuid,
      disabled_at timestamptz,
      execution_class text
    );

    create table private.worker_tasks (
      id uuid,
      execution_class text,
      workspace_id uuid,
      scan_job_id uuid,
      asset_id uuid,
      state text,
      absolute_deadline_at timestamptz,
      updated_at timestamptz
    );

    create table private.worker_attempts (
      id uuid,
      task_id uuid,
      worker_id uuid,
      lease_token_hash text,
      finished_at timestamptz,
      lease_expires_at timestamptz,
      leased_at timestamptz,
      outcome text,
      terminal_payload_digest text,
      failure_code text,
      wall_time_ms integer,
      cpu_time_ms integer,
      peak_memory_bytes bigint,
      input_bytes bigint,
      output_bytes bigint
    );

    create table private.phase11_http_worker_tasks (
      task_id uuid,
      workspace_id uuid,
      run_id uuid,
      action_id text,
      authorization_id text,
      authorization_snapshot_ref text,
      target_node_id text,
      capability_id text,
      capability_version text,
      provider_id text,
      provider_version text
    );

    create table private.pentest_runs (
      id uuid,
      workspace_id uuid,
      status text,
      authorization_snapshot_ref text
    );

    create table private.pentest_run_authorization_snapshots (
      workspace_id uuid,
      run_id uuid,
      snapshot_ref text,
      expires_at timestamptz,
      authorized_node_ids text[]
    );

    create table private.pentest_graph_nodes (
      workspace_id uuid,
      run_id uuid,
      node_id text,
      asset_type text,
      canonical_locator text,
      parent_node_ids text[],
      authorization_ref text,
      technology_tags text[],
      confidence double precision,
      provenance_refs text[],
      updated_at timestamptz
    );

    create table private.pentest_graph_edges (
      workspace_id uuid,
      run_id uuid,
      edge_id text,
      from_node_id text,
      to_node_id text,
      relationship text,
      provenance_kind text,
      provenance_refs text[],
      confidence double precision,
      observed_at timestamptz,
      authorization_ref text,
      stale boolean,
      updated_at timestamptz
    );

    create table private.pentest_hypotheses (
      workspace_id uuid,
      run_id uuid,
      hypothesis_id text,
      reasoning_source text,
      target_node_ids text[],
      statement text,
      preconditions text[],
      candidate_capability_ids text[],
      expected_evidence_types text[],
      base_confidence double precision,
      confidence double precision,
      status text,
      evidence_refs text[],
      updated_at timestamptz
    );

    create table private.pentest_run_events (
      id uuid,
      workspace_id uuid,
      run_id uuid,
      event_type text,
      metadata jsonb,
      created_at timestamptz
    );

    create table public.pentest_coverage_summaries (
      workspace_id uuid,
      run_id uuid,
      attempted_capability_count integer,
      covered_node_count integer,
      untested_node_count integer,
      request_count integer,
      graph_expansion_count integer,
      provider_failure_count integer,
      started_at timestamptz,
      deadline_at timestamptz,
      updated_at timestamptz,
      primary key (workspace_id, run_id)
    );

    create table public.pentest_action_summaries (
      workspace_id uuid,
      run_id uuid,
      action_id text,
      state text,
      updated_at timestamptz
    );

    create table public.pentest_graph_node_summaries (
      workspace_id uuid,
      run_id uuid,
      node_id text,
      asset_type text,
      parent_node_ids text[],
      technology_tags text[],
      confidence double precision,
      updated_at timestamptz
    );

    create table public.pentest_graph_edge_summaries (
      workspace_id uuid,
      run_id uuid,
      edge_id text,
      from_node_id text,
      to_node_id text,
      relationship text,
      confidence double precision,
      stale boolean,
      updated_at timestamptz
    );

    create table public.pentest_hypothesis_summaries (
      workspace_id uuid,
      run_id uuid,
      hypothesis_id text,
      target_node_ids text[],
      candidate_capability_ids text[],
      confidence double precision,
      status text,
      updated_at timestamptz
    );

    create function private.assert_phase11_run_scope(uuid, uuid, text)
    returns void language sql as $$ select $$;

    create function public.persist_phase11_observations(uuid, uuid, text, jsonb)
    returns jsonb language sql as $$ select '{}'::jsonb $$;

    create function private.record_worker_event(text, uuid, uuid, uuid, jsonb)
    returns void language sql as $$ select $$;
  `);

  await db.exec(await readFile(migrationPath, "utf8"));
}, 30_000);

afterAll(async () => {
  await db?.close();
});

describe("Phase 11C result coverage database migration", () => {
  it("executes against PostgreSQL-compatible PGlite and installs the closed functions", async () => {
    const result = await db.query<{ routine_schema: string; routine_name: string }>(`
      select routine_schema, routine_name
      from information_schema.routines
      where (routine_schema, routine_name) in (
        ('private', 'apply_phase11_attempt_coverage'),
        ('public', 'get_phase11_http_worker_finalization_context'),
        ('public', 'finalize_phase11_http_worker_attempt'),
        ('private', 'recover_phase11_http_unleased_worker_tasks'),
        ('private', 'recover_phase11_http_expired_worker_attempts'),
        ('public', 'persist_phase11_graph_state')
      )
      order by routine_schema, routine_name
    `);

    expect(result.rows).toHaveLength(6);
  });

  it("adds request_count to the private action-attempt row", async () => {
    const result = await db.query<{ column_name: string }>(`
      select column_name
      from information_schema.columns
      where table_schema = 'private'
        and table_name = 'pentest_action_attempts'
        and column_name = 'request_count'
    `);
    expect(result.rows).toHaveLength(1);
  });
});
