import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260918061500_phase_11a_planning_graph.sql",
);

describe("Phase 11A planning persistence migration", () => {
  it("keeps canonical run, graph, observation, hypothesis, coverage, and event state private", async () => {
    const sql = await readFile(migrationPath, "utf8");
    for (const table of [
      "pentest_runs",
      "pentest_graph_nodes",
      "pentest_graph_edges",
      "pentest_observations",
      "pentest_hypotheses",
      "pentest_coverage",
      "pentest_run_events",
    ]) {
      expect(sql).toContain(`create table private.${table}`);
      expect(sql).toContain(`alter table private.${table} enable row level security`);
      expect(sql).toContain(`revoke all on table private.${table} from public, anon, authenticated, service_role`);
    }
  });

  it("exposes only privacy-reduced member-readable summaries with SELECT-only browser grants", async () => {
    const sql = await readFile(migrationPath, "utf8");
    for (const table of [
      "pentest_run_summaries",
      "pentest_graph_node_summaries",
      "pentest_graph_edge_summaries",
      "pentest_observation_summaries",
      "pentest_hypothesis_summaries",
      "pentest_coverage_summaries",
    ]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke all on table public.${table} from public, anon, authenticated, service_role`);
      expect(sql).toContain(`grant select on table public.${table} to authenticated`);
    }
    expect(sql).toMatch(/pentest_graph_node_summaries_select_member[\s\S]*private\.is_workspace_member\(workspace_id\)/i);
    expect(sql).toMatch(/pentest_observation_summaries_select_member[\s\S]*private\.is_workspace_member\(workspace_id\)/i);
    expect(sql).not.toMatch(/grant\s+(insert|update|delete)\s+on\s+table\s+public\.pentest_/i);
  });

  it("does not expose canonical locators, evidence refs, observation facts, statements, or authorization refs in public read tables", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const publicSection = sql.slice(
      sql.indexOf("create table public.pentest_run_summaries"),
      sql.indexOf("create or replace function public.persist_phase11_graph_state"),
    );
    expect(publicSection).not.toContain("canonical_locator");
    expect(publicSection).not.toContain("evidence_refs");
    expect(publicSection).not.toContain(" facts ");
    expect(publicSection).not.toContain("statement text");
    expect(publicSection).not.toContain("authorization_snapshot_ref");
    expect(publicSection).not.toContain("authorization_ref");
  });

  it("uses service-role-only SECURITY DEFINER persistence with pinned search paths", async () => {
    const sql = await readFile(migrationPath, "utf8");
    for (const fn of ["persist_phase11_graph_state", "persist_phase11_observations"]) {
      expect(sql).toMatch(new RegExp(`create or replace function public\\.${fn}[\\s\\S]*security definer[\\s\\S]*set search_path = ''`, "i"));
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${fn}[\\s\\S]*from public, anon, authenticated`, "i"));
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${fn}[\\s\\S]*to service_role`, "i"));
    }
  });

  it("binds every trusted write to the exact workspace, run, and authorization snapshot", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/from private\.pentest_runs[\s\S]*id = target_run_id[\s\S]*workspace_id = target_workspace_id[\s\S]*for update/i);
    expect(sql).toContain("run_record.authorization_snapshot_ref is distinct from target_authorization_snapshot_ref");
    expect(sql).toContain("PHASE11_AUTHORIZATION_SNAPSHOT_MISMATCH");
    expect(sql).toContain("PHASE11_RUN_TERMINAL");
  });

  it("bounds payload size and makes observation identity immutable/idempotent", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("node_count > 1000");
    expect(sql).toContain("edge_count > 2000");
    expect(sql).toContain("hypothesis_count > 1000");
    expect(sql).toContain("event_count > 500");
    expect(sql).toContain("jsonb_array_length(observation_rows) > 2000");
    expect(sql).toMatch(/insert into private\.pentest_observations[\s\S]*on conflict \(workspace_id, run_id, observation_id\) do nothing/i);
    expect(sql).toContain("PHASE11_OBSERVATION_IDENTITY_CONFLICT");
    expect(sql).toContain("replayedCount");
  });

  it("covers Phase 11 foreign-key paths with indexes", async () => {
    const sql = await readFile(migrationPath, "utf8");
    for (const indexName of [
      "pentest_runs_root_asset_workspace_idx",
      "pentest_graph_nodes_run_idx",
      "pentest_graph_edges_from_node_idx",
      "pentest_graph_edges_to_node_idx",
      "pentest_observations_run_observed_idx",
      "pentest_hypotheses_run_status_idx",
      "pentest_run_events_run_created_idx",
      "pentest_run_summaries_root_asset_workspace_idx",
      "pentest_graph_node_summaries_run_idx",
      "pentest_observation_summaries_run_observed_idx",
    ]) {
      expect(sql).toContain(indexName);
    }
  });
});
