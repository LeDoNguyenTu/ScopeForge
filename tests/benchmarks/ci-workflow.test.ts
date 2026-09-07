import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("Phase 8 CI validation ordering", () => {
  it("runs npm audit before executable validation and keeps the benchmark sequence stable", async () => {
    const workflow = await readFile(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
    const audit = workflow.indexOf("npm audit --audit-level=info");
    const tests = workflow.indexOf("npm test");
    const historical = workflow.indexOf("npm run benchmark:scanner");
    const matrix = workflow.indexOf("npm run benchmark:matrix");
    const build = workflow.indexOf("- run: npm run build\n");

    expect(audit).toBeGreaterThanOrEqual(0);
    expect(tests).toBeGreaterThan(audit);
    expect(historical).toBeGreaterThan(tests);
    expect(matrix).toBeGreaterThan(historical);
    expect(build).toBeGreaterThan(matrix);
  });
});
