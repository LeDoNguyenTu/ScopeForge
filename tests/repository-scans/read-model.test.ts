import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readModelPath = path.resolve("lib/repository-scans/read-model.ts");

describe("Phase 6C repository scan read model", () => {
  it("returns only safe run and queue provenance for one workspace asset", async () => {
    const source = await readFile(readModelPath, "utf8");
    expect(source).toContain("repository_scan_runs");
    expect(source).toContain("scan_jobs");
    expect(source).toContain("repository_scan");
    expect(source).toContain("workspace_id");
    expect(source).toContain("asset_id");
    for (const forbidden of [
      "object_key",
      "lease_token",
      "worker_id",
      "container",
      "sourceDirectory",
      "download",
      "secretAccessKey",
      "accessKeyId",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
