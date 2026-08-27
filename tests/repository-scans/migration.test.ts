import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const enumMigration = path.resolve(
  "supabase/migrations/20260827020000_phase_6c_repository_scan_enum.sql",
);
const schemaMigration = path.resolve(
  "supabase/migrations/20260827020100_phase_6c_repository_scan_schema.sql",
);

describe("Phase 6C repository scan schema migrations", () => {
  it("adds repository_scan as a distinct scan job kind", async () => {
    const sql = await readFile(enumMigration, "utf8");
    expect(sql).toMatch(/alter type public\.scan_job_kind\s+add value if not exists 'repository_scan'/i);
  });

  it("extends only the fixed worker class constraints", async () => {
    const sql = await readFile(schemaMigration, "utf8");
    expect(sql).toContain("phase3_repository_scan_no_egress_v1");
    expect(sql).toMatch(/worker_nodes_execution_class_check/i);
    expect(sql).toMatch(/worker_tasks_execution_class_check/i);
    expect(sql).not.toMatch(/network_policy\s+(text|jsonb)/i);
    expect(sql).not.toMatch(/\bcommand\s+(text|jsonb)/i);
    expect(sql).not.toMatch(/\bimage\s+(text|jsonb)/i);
    expect(sql).not.toMatch(/\benvironment\s+jsonb/i);
  });

  it("pins the repository scan job budget and keeps runtime authorization fields empty", async () => {
    const sql = await readFile(schemaMigration, "utf8");
    expect(sql).toContain("scan_jobs_repository_scan_contract_check");
    expect(sql).toContain('{"maxWallTimeMs":300000,"maxCpuTimeMs":300000,"maxMemoryBytes":1073741824,"maxProcesses":64,"maxInputFiles":20000,"maxInputBytes":268435456,"maxScratchBytes":268435456,"maxOutputBytes":3670016}');
    for (const field of [
      "authorization_canonical_target is null",
      "authorization_asset_kind is null",
      "authorization_verified_at is null",
      "validation_profile_id is null",
      "validation_profile_version is null",
      "authorization_granted_at is null",
    ]) {
      expect(sql).toContain(field);
    }
  });

  it("binds private scan tasks to one exact workspace asset snapshot and job", async () => {
    const sql = await readFile(schemaMigration, "utf8");
    expect(sql).toContain("create table private.repository_scan_tasks");
    expect(sql).toContain("snapshot_id uuid not null");
    expect(sql).toContain("scanner_profile_id text not null default 'phase3-hosted-static-v1'");
    expect(sql).toContain("scanner_profile_version smallint not null default 1");
    expect(sql).toContain("foreign key (snapshot_id, workspace_id, asset_id)");
    expect(sql).toContain("references public.repository_source_snapshots(id, workspace_id, asset_id)");
    expect(sql).toContain("foreign key (scan_job_id, workspace_id, asset_id)");
    expect(sql).toContain("references public.scan_jobs(id, workspace_id, asset_id)");
  });

  it("creates immutable member-readable hosted scan provenance without worker internals", async () => {
    const sql = await readFile(schemaMigration, "utf8");
    expect(sql).toContain("create table public.repository_scan_runs");
    expect(sql).toContain("snapshot_id uuid not null");
    expect(sql).toContain("resolved_commit_sha text not null");
    expect(sql).toContain("snapshot_content_digest text not null");
    expect(sql).toContain("snapshot_artifact_digest text not null");
    expect(sql).toContain("result_digest text not null");
    expect(sql).toContain("run_ref text not null");
    expect(sql).toContain("unique (workspace_id, asset_id, run_ref)");
    expect(sql).not.toMatch(/run_ref text not null unique/i);
    expect(sql).toContain("repository_scan_runs_guard_update");
    expect(sql).toContain("repository_scan_runs_guard_delete");
    expect(sql).toContain("repository_scan_runs_member_select");
    expect(sql).toMatch(/grant select on table public\.repository_scan_runs to authenticated/i);
    expect(sql).toMatch(/revoke all on table public\.repository_scan_runs from public, anon, authenticated, service_role/i);
    for (const forbidden of ["worker_id", "lease_token", "object_key", "artifact_url", "container_id"] ) {
      expect(sql).not.toMatch(new RegExp(`\\b${forbidden}\\b`, "i"));
    }
  });

  it("provides covering indexes for every new foreign-key path", async () => {
    const sql = await readFile(schemaMigration, "utf8");
    for (const index of [
      "repository_scan_tasks_job_workspace_asset_idx",
      "repository_scan_tasks_snapshot_workspace_asset_idx",
      "repository_scan_tasks_asset_workspace_idx",
      "repository_scan_runs_job_workspace_asset_idx",
      "repository_scan_runs_snapshot_workspace_asset_idx",
      "repository_scan_runs_asset_workspace_idx",
    ]) {
      expect(sql).toContain(index);
    }
  });
});