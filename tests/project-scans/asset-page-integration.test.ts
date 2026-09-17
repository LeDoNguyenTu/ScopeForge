import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = path.resolve("app/dashboard/assets/[assetId]/page.tsx");

describe("connected project asset page integration", () => {
  it("loads the project-level scan path and keeps legacy panels in history-only mode", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toContain("loadConnectedProjectScanReadModel");
    expect(source).toContain("ConnectedProjectScanPanel");
    expect(source).toContain("HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED");
    expect(source).toContain("HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED");
    expect(source).toContain("HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED");
    expect(source).toContain("privateSnapshotRuntimeAvailable={HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED}");
    expect(source).toContain("<RepositorySnapshotPanel");
    expect(source).toContain("<RepositoryScanPanel");
    expect(source).toContain("managedByConnectedProject={Boolean(connectedProjectScan)}");
    expect(source).toContain("<RepositoryImportPanel");
  });
});
