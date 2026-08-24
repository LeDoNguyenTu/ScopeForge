import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const actionPath = path.resolve(
  process.cwd(),
  "app/dashboard/findings/[findingId]/actions.ts",
);

describe("finding lifecycle server action boundary", () => {
  it("accepts only the finding id, narrow Phase 5A action, and optional note", async () => {
    const source = await readFile(actionPath, "utf8");

    expect(source).toContain("changeFindingLifecycleAction");
    expect(source).toContain("Phase5ALifecycleAction");
    expect(source).toContain("getDashboardContext");
    expect(source).toContain("createAdminClient");
    expect(source).toContain("createSecurityFindingRepository");
    expect(source).toContain("changeFindingLifecycle");
    expect(source).toMatch(
      /changeFindingLifecycleAction\(\s*findingId:\s*string,\s*action:\s*Phase5ALifecycleAction,\s*note\?:\s*string[\s\S]*?\)/,
    );
    expect(source).not.toMatch(/toLifecycle\s*:/i);
    expect(source).not.toMatch(/accepted_risk|false_positive|retest_pending|verified_fixed/);
  });
});
