import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { reconcileConnectedProjectSnapshotTerminal } from "@/lib/project-scans/service";

const SNAPSHOT_TASK_ID = "55555555-5555-4555-8555-555555555555";
const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260917070000_phase_10a2_project_snapshot_terminal_recovery.sql",
);
const finalizeRoutePath = path.resolve(process.cwd(), "app/api/internal/workers/finalize/route.ts");

describe("connected project snapshot terminal recovery", () => {
  it("reconciles terminal snapshot tasks through the service-only persistence boundary", async () => {
    const reconcileSnapshotTerminal = vi.fn(async () => undefined);

    await expect(reconcileConnectedProjectSnapshotTerminal(
      { snapshotTaskId: SNAPSHOT_TASK_ID },
      { reconcileSnapshotTerminal },
    )).resolves.toEqual({ status: "reconciled" });
    expect(reconcileSnapshotTerminal).toHaveBeenCalledWith(SNAPSHOT_TASK_ID);
  });

  it("releases only terminal failed or cancelled snapshot intents for a truthful retry", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("create or replace function public.reconcile_connected_project_snapshot_terminal");
    expect(sql).toMatch(/task_record\.state not in \('completed', 'dead_letter'\)/i);
    expect(sql).toMatch(/job_record\.status not in \([\s\S]*'failed'[\s\S]*'cancelled'/i);
    expect(sql).toMatch(/terminal_error_code := coalesce\([\s\S]*job_record\.failure_code/i);
    expect(sql).toMatch(/set state = 'idle',[\s\S]*last_error_code = terminal_error_code/i);
    expect(sql).toMatch(/set project_scan_state = 'idle'/i);
    expect(sql).toMatch(/grant execute on function public\.reconcile_connected_project_snapshot_terminal\(uuid\)[\s\S]*to service_role/i);
    expect(sql).toMatch(/revoke all on function public\.reconcile_connected_project_snapshot_terminal\(uuid\)[\s\S]*from public, anon, authenticated, service_role/i);
  });

  it("reconciles a failed snapshot only after its worker finalization is durable", async () => {
    const source = await readFile(finalizeRoutePath, "utf8");
    const finalizeIndex = source.lastIndexOf("finalizeWorkerAttempt");
    const reconcileIndex = source.lastIndexOf("reconcileConnectedProjectSnapshotTerminal");

    expect(finalizeIndex).toBeGreaterThan(-1);
    expect(reconcileIndex).toBeGreaterThan(finalizeIndex);
  });
});
