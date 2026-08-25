import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = path.resolve(
  process.cwd(),
  "app/dashboard/assets/[assetId]/page.tsx",
);

describe("repository Phase 3 import asset-page integration", () => {
  it("renders the hosted import panel only for repository assets and loads bounded history through the import repository", async () => {
    const source = await readFile(pagePath, "utf8");

    expect(source).toContain("RepositoryImportPanel");
    expect(source).toContain("createPhase3ImportRepository");
    expect(source).toContain("listRecentImports(workspace.id, asset.id, 20)");
    expect(source).toMatch(/asset\.kind\s*===\s*"repository"[\s\S]*?<RepositoryImportPanel/);
    expect(source).toContain("repositoryUrl={asset.canonical_target}");
    expect(source).toContain("history={repositoryImportHistory}");
  });
});
