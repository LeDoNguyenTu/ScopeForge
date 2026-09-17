import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  "supabase/migrations/20260911110000_phase_10a2_private_project_scan_routing.sql",
);

describe("Phase 10A2 private connected-project routing migration", () => {
  it("queues private acquisition and records the project intent atomically", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("create or replace function public.enqueue_connected_private_project_snapshot");
    expect(sql).toContain("public.enqueue_private_repository_snapshot_worker_task");
    expect(sql).toContain("private.github_project_scan_intents");
    expect(sql).toContain("'snapshot_queued'");
    expect(sql).toContain("project_scan_state = 'snapshot_queued'");
  });

  it("widens continuation and recovery only to active connected projects", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("create or replace function public.get_connected_project_scan_recovery");
    expect(sql).toContain("create or replace function public.enqueue_connected_project_scan_continuation");
    expect(sql).toContain("l.access_status = 'active'");
    expect(sql).toContain("c.status = 'active'");
    expect(sql).toContain("continuation->>'accessStatus' <> 'active'");
    expect(sql).not.toContain("not l.is_private");
    expect(sql).not.toContain("(continuation->>'isPrivate')::boolean");
  });

  it("keeps repository scanning bound to the exact published snapshot", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("public.enqueue_repository_scan_worker_task_for_snapshot");
    expect(sql).toContain("target_snapshot_id");
    expect(sql).toContain("PROJECT_SCAN_SNAPSHOT_MISMATCH");
  });

  it("keeps all public SECURITY DEFINER entry points service-role only", async () => {
    const sql = (await readFile(migrationPath, "utf8")).replace(/\s+/g, " ");
    for (const signature of [
      "public.enqueue_connected_private_project_snapshot(uuid, uuid, uuid, uuid)",
      "public.get_connected_project_scan_recovery(uuid, uuid, uuid, uuid)",
      "public.enqueue_connected_project_scan_continuation(uuid, uuid)",
    ]) {
      expect(sql).toContain(`revoke all on function ${signature}`);
      expect(sql).toContain(`grant execute on function ${signature} to service_role`);
    }
  });
});
