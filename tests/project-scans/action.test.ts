import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const actionPath = path.join(root, "app/dashboard/assets/[assetId]/project-scan-actions.ts");
const finalizeRoutePath = path.join(root, "app/api/internal/workers/finalize/route.ts");

describe("connected project scan integration", () => {
  it("exposes one project-level scan action without bypassing runtime gates", async () => {
    const source = await readFile(actionPath, "utf8");
    expect(source).toContain("requestConnectedProjectScan");
    expect(source).toContain("snapshot_runtime_unavailable");
    expect(source).toContain("private_snapshot_runtime_unavailable");
    expect(source).not.toContain("private_acquisition_required");
    expect(source).not.toContain("enqueue_repository_scan_worker_task");
  });

  it("continues after successful public or private immutable repository snapshot publication", async () => {
    const source = await readFile(finalizeRoutePath, "utf8");
    const publicPublishIndex = source.indexOf("publishRepositorySnapshotAttempt");
    const privatePublishIndex = source.indexOf("publishPrivateRepositorySnapshotAttempt");
    const continuationIndex = source.lastIndexOf("continueConnectedProjectScanAfterSnapshot");
    expect(publicPublishIndex).toBeGreaterThan(-1);
    expect(privatePublishIndex).toBeGreaterThan(-1);
    expect(continuationIndex).toBeGreaterThan(publicPublishIndex);
    expect(continuationIndex).toBeGreaterThan(privatePublishIndex);
    expect(source).toContain("repository_snapshot_github_public_v1");
    expect(source).toContain("repository_snapshot_github_private_v1");
    expect(source).toContain("result.snapshotId");
  });
});
