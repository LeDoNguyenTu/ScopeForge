import { describe, expect, it, vi } from "vitest";
import { createPhase3ImportRepository } from "@/lib/phase3-import/repository";

const historyRow = {
  id: "import-1",
  workspace_id: "workspace-1",
  asset_id: "asset-1",
  scan_job_id: "job-1",
  run_ref: `sfh1:${"a".repeat(64)}`,
  tool_version: "0.1.0",
  scan_started_at: "2026-08-26T00:00:00.000Z",
  scan_duration_ms: 125,
  scanner_error_count: 0,
  files_analyzed: 12,
  finding_count: 3,
  created_at: "2026-08-26T00:00:01.000Z",
};

describe("Phase 3 import repository", () => {
  it("lists recent imports only for the selected workspace and repository asset with a hard bound", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn(async () => ({ data: [historyRow], error: null })),
    };
    const from = vi.fn(() => query);
    const client = { from } as unknown as Parameters<typeof createPhase3ImportRepository>[0];
    const repository = createPhase3ImportRepository(client);

    const result = await repository.listRecentImports("workspace-1", "asset-1", 20);

    expect(from).toHaveBeenCalledWith("security_phase3_import_runs");
    expect(query.select).toHaveBeenCalledWith(
      "id,workspace_id,asset_id,scan_job_id,run_ref,tool_version,scan_started_at,scan_duration_ms,scanner_error_count,files_analyzed,finding_count,created_at",
    );
    expect(query.eq).toHaveBeenNthCalledWith(1, "workspace_id", "workspace-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "asset_id", "asset-1");
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(20);
    expect(result).toEqual([historyRow]);
  });

  it("clamps caller-provided history limits and returns a safe generic failure", async () => {
    const limit = vi.fn(async () => ({ data: [], error: { message: "database details" } }));
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit,
    };
    const client = { from: vi.fn(() => query) } as unknown as Parameters<typeof createPhase3ImportRepository>[0];
    const repository = createPhase3ImportRepository(client);

    await expect(repository.listRecentImports("workspace-1", "asset-1", 5000)).rejects.toThrow(
      "Unable to load Phase 3 import history.",
    );
    expect(limit).toHaveBeenCalledWith(50);
  });
});