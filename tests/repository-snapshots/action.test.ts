import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const actionPath = path.resolve(
  process.cwd(),
  "app/dashboard/assets/[assetId]/snapshot-actions.ts",
);

describe("Phase 6B repository snapshot action", () => {
  it("resolves membership for the selected asset workspace instead of the first membership", async () => {
    const source = await readFile(actionPath, "utf8");
    expect(source).toContain('.eq("id", assetId)');
    expect(source).toContain('.eq("workspace_id", asset.workspace_id)');
    expect(source).toContain('.eq("user_id", user.id)');
    expect(source).not.toMatch(/workspace_members[\s\S]{0,300}[.]limit\(1\)/);
  });

  it("passes only trusted IDs into the snapshot service", async () => {
    const source = await readFile(actionPath, "utf8");
    expect(source).toContain("workspaceId: asset.workspace_id");
    expect(source).toContain("assetId: asset.id");
    expect(source).toContain("actorId: user.id");
    for (const forbidden of [
      "repositoryUrl:",
      "branch:",
      "ref:",
      "commitSha:",
      "budget:",
      "networkPolicy:",
      "executionClass:",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("requires owner/admin and repository asset kind", async () => {
    const source = await readFile(actionPath, "utf8");
    expect(source).toContain('asset.kind !== "repository"');
    expect(source).toContain('membership.role !== "owner" && membership.role !== "admin"');
  });
});
