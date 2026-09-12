import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = path.resolve("app/dashboard/assets/[assetId]/page.tsx");

describe("connected project asset page integration", () => {
  it("loads and renders the project-level one-click scan path without removing manual repository tools", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toContain("loadConnectedProjectScanReadModel");
    expect(source).toContain("ConnectedProjectScanPanel");
    expect(source).toContain("HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED");
    expect(source).toContain("HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED");
    expect(source).toContain("<RepositorySnapshotPanel");
    expect(source).toContain("<RepositoryScanPanel");
    expect(source).toContain("<RepositoryImportPanel");
  });
});
