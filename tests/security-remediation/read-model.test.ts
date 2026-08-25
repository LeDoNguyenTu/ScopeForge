import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repositoryPath = path.resolve(process.cwd(), "lib/security-findings/repository.ts");

describe("Phase 5B workflow read model", () => {
  it("loads current remediation work and at most 50 newest retests inside the workspace", async () => {
    const source = await readFile(repositoryPath, "utf8");

    expect(source).toContain("loadWorkspaceFindingWorkflowDetail");
    expect(source).toContain('.from("security_finding_work")');
    expect(source).toContain('.from("security_finding_retests")');
    expect(source).toMatch(/\.eq\("workspace_id",\s*workspaceId\)/);
    expect(source).toMatch(/\.eq\("finding_id",\s*findingId\)/);
    expect(source).toMatch(/\.order\("requested_at",\s*\{\s*ascending:\s*false\s*\}\)/);
    expect(source).toMatch(/\.limit\(50\)/);
  });
});
