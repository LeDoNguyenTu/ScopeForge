import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { reconcileConnectedProjectScanTerminal } from "@/lib/project-scans/service";

const SCAN_TASK_ID = "66666666-6666-4666-8666-666666666666";
const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260917080000_phase_10a2_project_scan_success_completion.sql",
);
const finalizeRoutePath = path.resolve(process.cwd(), "app/api/internal/workers/finalize/route.ts");
const successFinalizeRoutePath = path.resolve(
  process.cwd(),
  "app/api/internal/workers/repository-scans/finalize/route.ts",
);

describe("connected project scan terminal recovery", () => {
  it("reconciles terminal scan tasks through the service-only persistence boundary", async () => {
    const reconcileScanTerminal = vi.fn(async () => undefined);

    await expect(reconcileConnectedProjectScanTerminal(
      { scanTaskId: SCAN_TASK_ID },
      { reconcileScanTerminal },
    )).resolves.toEqual({ status: "reconciled" });
    expect(reconcileScanTerminal).toHaveBeenCalledWith(SCAN_TASK_ID);
  });

  it("keeps the immutable snapshot and releases only terminal scans for a truthful retry", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("create or replace function public.reconcile_connected_project_scan_terminal");
    expect(sql).toMatch(/task_record\.state not in \('completed', 'dead_letter'\)/i);
    expect(sql).toMatch(/job_record\.status not in \([\s\S]*'failed'[\s\S]*'cancelled'/i);
    expect(sql).toMatch(/set state = 'retry_pending',[\s\S]*scan_task_id = null,[\s\S]*scan_job_id = null/i);
    expect(sql).not.toMatch(/snapshot_id\s*=\s*null/i);
    expect(sql).toMatch(/set project_scan_state = 'retry_pending'/i);
    expect(sql).toMatch(/grant execute on function public\.reconcile_connected_project_scan_terminal\(uuid\)[\s\S]*to service_role/i);
    expect(sql).toMatch(/revoke all on function public\.reconcile_connected_project_scan_terminal\(uuid\)[\s\S]*from public, anon, authenticated, service_role/i);
  });

  it("returns a successfully published connected-project scan to idle", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toMatch(/job_record\.status = 'succeeded'/i);
    expect(sql).toMatch(/set state = 'idle',[\s\S]*scan_task_id = null,[\s\S]*scan_job_id = null,[\s\S]*last_error_code = null/i);
    expect(sql).toMatch(/set project_scan_state = 'idle'/i);
  });

  it("reconciles a failed scan only after its worker finalization is durable", async () => {
    const source = await readFile(finalizeRoutePath, "utf8");
    const finalizeIndex = source.lastIndexOf("finalizeWorkerAttempt");
    const reconcileIndex = source.lastIndexOf("reconcileConnectedProjectScanTerminal");

    expect(finalizeIndex).toBeGreaterThan(-1);
    expect(reconcileIndex).toBeGreaterThan(finalizeIndex);
  });

  it("reconciles a successful scan only after its publication is durable", async () => {
    const source = await readFile(successFinalizeRoutePath, "utf8");
    const publishIndex = source.lastIndexOf("publishRepositoryScanSuccess");
    const reconcileIndex = source.lastIndexOf("reconcileConnectedProjectScanTerminal");

    expect(publishIndex).toBeGreaterThan(-1);
    expect(reconcileIndex).toBeGreaterThan(publishIndex);
  });
});
