import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routePath = path.resolve("app/api/internal/workers/repository-scans/finalize/route.ts");
const transportPath = path.resolve("lib/worker-control/transport.ts");

describe("Phase 6C dedicated finalize route", () => {
  it("authenticates the worker, binds task/attempt separately from terminal, and uses a 4 MiB streamed cap", async () => {
    const [route, transport] = await Promise.all([
      readFile(routePath, "utf8"),
      readFile(transportPath, "utf8"),
    ]);
    expect(route).toContain("authenticateWorkerRequest");
    expect(route).toContain("phase3_repository_scan_no_egress_v1");
    expect(route).toContain('strictObject(await readBoundedWorkerJsonWithLimit(request, 4 * 1024 * 1024), ["taskId", "attemptId", "leaseToken", "terminal"])');
    expect(route).toContain("workerUuid(body.taskId)");
    expect(route).toContain("workerUuid(body.attemptId)");
    expect(route).toContain("publishRepositoryScanSuccess");
    expect(transport).toContain("readBoundedWorkerJsonWithLimit");
  });

  it("does not accept caller-selected workspace, asset, snapshot, storage, scanner profile, or persistence rows", async () => {
    const route = await readFile(routePath, "utf8");
    for (const forbidden of [
      "workspaceId: body",
      "assetId: body",
      "snapshotId: body",
      "objectKey",
      "bucket",
      "scannerProfileId: body",
      "findings: body",
      "evidence: body",
      "repositoryCanonicalUrl: body",
    ]) {
      expect(route).not.toContain(forbidden);
    }
  });
});
