import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const actionPath = path.resolve(
  process.cwd(),
  "app/dashboard/findings/[findingId]/remediation-actions.ts",
);

describe("Phase 5B remediation action boundary", () => {
  it("keeps remediation and retest actions narrow and server-authorized", async () => {
    const source = await readFile(actionPath, "utf8");

    expect(source).toContain("getDashboardContext");
    expect(source).toContain("createAdminClient");
    expect(source).toContain("updateFindingWork");
    expect(source).toContain("requestFindingRetest");
    expect(source).toContain("executeFindingRetest");

    const updateSignature = source.match(/updateFindingRemediationAction\([\s\S]*?\)\s*:/)?.[0] ?? "";
    expect(updateSignature).toMatch(/findingId:\s*string/);
    expect(updateSignature).toMatch(/assigneeUserId:\s*string\s*\|\s*null/);
    expect(updateSignature).toMatch(/remediationNote:\s*string\s*\|\s*null/);

    const retestSignature = source.match(/runFindingRetestAction\([\s\S]*?\)\s*:/)?.[0] ?? "";
    expect(retestSignature).toMatch(/findingId:\s*string/);
    expect(retestSignature).toMatch(/explicitConsent:\s*boolean/);
    expect(retestSignature).not.toMatch(/url|target|method|headers|body|source|profile|budget|scanJobId|result|lifecycle/i);
  });
});
