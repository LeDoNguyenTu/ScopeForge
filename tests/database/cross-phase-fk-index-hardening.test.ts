import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  "supabase/migrations/20260921094500_cross_phase_fk_index_hardening.sql",
);

describe("cross-phase foreign-key index hardening", () => {
  it("adds the complete covering-index set reported by the live performance advisor", async () => {
    const sql = await readFile(migrationPath, "utf8");

    for (const indexName of [
      "github_project_scan_intents_asset_workspace_idx",
      "github_project_scan_intents_link_workspace_idx",
      "github_project_scan_intents_requested_by_idx",
      "github_repository_auto_scan_state_link_workspace_idx",
      "pentest_approval_events_approved_by_idx",
      "pentest_run_authorization_snapshots_created_by_idx",
      "pentest_session_leases_created_by_idx",
      "pentest_session_leases_run_workspace_idx",
      "phase11_http_worker_tasks_target_idx",
      "repository_snapshot_tasks_link_workspace_idx",
      "github_connections_installed_by_idx",
      "github_repository_links_asset_workspace_idx",
      "github_repository_links_connection_workspace_idx",
      "pentest_coverage_summaries_run_workspace_idx",
      "platform_admins_created_by_idx",
      "platform_settings_updated_by_idx",
    ]) {
      expect(sql).toContain(`create index if not exists ${indexName}`);
    }
  });

  it("keeps the hardening slice authority-neutral", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).not.toMatch(/\b(alter|drop|grant|revoke|create\s+policy|create\s+function|replace\s+function)\b/i);
    expect(sql).not.toMatch(/row\s+level\s+security/i);
    expect(sql.match(/create index if not exists/gi)?.length).toBe(16);
  });
});
