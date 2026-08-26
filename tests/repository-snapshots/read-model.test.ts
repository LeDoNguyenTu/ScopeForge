import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readModelPath = path.resolve(process.cwd(), "lib/repository-snapshots/read-model.ts");

describe("Phase 6B repository snapshot read model", () => {
  it("selects only safe public provenance and caps history at 20", async () => {
    const source = await readFile(readModelPath, "utf8");
    expect(source).toContain('from("repository_source_snapshots")');
    expect(source).toContain('.eq("workspace_id", workspaceId)');
    expect(source).toContain('.eq("asset_id", assetId)');
    expect(source).toContain('.order("created_at", { ascending: false })');
    expect(source).toContain("Math.min(20");
    for (const forbidden of [
      "object_key",
      "artifactObjectKey",
      "download_url",
      "signed_url",
      "R2_",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
