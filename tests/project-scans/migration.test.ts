import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  "supabase/migrations/20260910160000_phase_10a1_github_connected_projects.sql",
);

describe("Phase 10A1 connected project scan persistence", () => {
  it("keeps worker identifiers in a private durable intent table", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("create table private.github_project_scan_intents");
    expect(sql).toMatch(/snapshot_task_id\s+uuid/i);
    expect(sql).toMatch(/snapshot_id\s+uuid/i);
    expect(sql).toMatch(/scan_job_id\s+uuid/i);
    expect(sql).toMatch(/scan_task_id\s+uuid/i);
    expect(sql).toMatch(/unique\s*\(link_id\)/i);
    expect(sql).toMatch(/revoke all on table private\.github_project_scan_intents from public, anon, authenticated, service_role/i);
    expect(sql).not.toMatch(/github_repository_links[\s\S]*snapshot_task_id/i);
  });

  it("atomically enqueues a public snapshot and records its connected-project intent", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("create or replace function public.enqueue_connected_project_snapshot");
    expect(sql).toContain("enqueue_repository_snapshot_worker_task");
    expect(sql).toContain("github_project_scan_intents");
    expect(sql).toMatch(/revoke all on function public\.enqueue_connected_project_snapshot[\s\S]*from public, anon, authenticated, service_role/i);
    expect(sql).toMatch(/grant execute on function public\.enqueue_connected_project_snapshot[\s\S]*to service_role/i);
  });

  it("loads and updates continuation state only through service-role RPCs", async () => {
    const sql = await readFile(migrationPath, "utf8");
    for (const fn of [
      "get_connected_project_snapshot_continuation",
      "mark_connected_project_scan_waiting",
      "record_connected_project_scan_retry",
    ]) {
      expect(sql).toContain(`create or replace function public.${fn}`);
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${fn}[\\s\\S]*from public, anon, authenticated, service_role`, "i"));
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${fn}[\\s\\S]*to service_role`, "i"));
    }
  });

  it("makes snapshot-to-scan continuation idempotent and exact-snapshot bound", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("create or replace function public.enqueue_connected_project_scan_continuation");
    expect(sql).toContain("enqueue_repository_scan_worker_task");
    expect(sql).toMatch(/if intent_record\.state = 'scan_queued'[\s\S]*replayed[\s\S]*true/i);
    expect(sql).toMatch(/scan_enqueue_result->>'snapshotId'[\s\S]*target_snapshot_id::text/i);
    expect(sql).toContain("PROJECT_SCAN_SNAPSHOT_MISMATCH");
  });

  it("exposes only safe project-level state through the browser-readable link", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/project_scan_state\s+text\s+not null\s+default 'idle'/i);
    expect(sql).toMatch(/project_scan_state[\s\S]*'snapshot_queued'[\s\S]*'waiting_scan_runtime'[\s\S]*'scan_queued'[\s\S]*'retry_pending'/i);
    expect(sql).not.toMatch(/create table public\.github_repository_links[\s\S]*scan_task_id/i);
    expect(sql).not.toMatch(/create table public\.github_repository_links[\s\S]*scan_job_id/i);
  });
});
