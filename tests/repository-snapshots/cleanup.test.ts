import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260827030000_phase6b_repository_snapshot_cleanup.sql",
);

describe("Phase 6B repository snapshot cleanup migration", () => {
  it("requires a strict cleanup candidate age and immutable terminal attempt state", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("create or replace function public.list_repository_snapshot_cleanup_candidates");
    expect(sql).toContain("snapshot.created_at <= target_now - interval '24 hours'");
    expect(sql).toContain("attempt.finished_at is not null");
    expect(sql).toContain("attempt.lease_expires_at <= target_now");
    expect(sql).toContain("task.state in ('completed', 'dead_letter', 'cancelled')");
  });

  it("does not rely on mutable task state alone when identifying orphan artifacts", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("attempt.finished_at is not null");
    expect(sql).toContain("attempt.lease_expires_at <= target_now");
    expect(sql).not.toContain("or task.state <> 'leased'");
    expect(sql).not.toContain("task_record.state = 'leased'");
  });

  it("keeps cleanup service-role-only and public provenance immutable", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("create or replace function public.list_repository_snapshot_cleanup_candidates");
    expect(sql).toContain("create or replace function public.mark_repository_snapshot_artifact_deleted");
    expect(sql).toContain("interval '24 hours'");
    expect(sql).toContain("target_limit between 1 and 100");
    expect(sql).toContain("grant execute on function public.list_repository_snapshot_cleanup_candidates");
    expect(sql).toContain("grant execute on function public.mark_repository_snapshot_artifact_deleted");
    expect(sql).not.toMatch(/update\s+public[.]repository_source_snapshots/i);
    expect(sql).not.toMatch(/delete\s+from\s+public[.]repository_source_snapshots/i);
  });
});