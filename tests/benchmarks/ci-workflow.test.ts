import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("Phase 8B CI benchmark ordering", () => {
  it("runs the historical scanner benchmark before the performance matrix", async () => {
    const workflow = await readFile(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
    const historical = workflow.indexOf("npm run benchmark:scanner");
    const matrix = workflow.indexOf("npm run benchmark:matrix");

    expect(historical).toBeGreaterThanOrEqual(0);
    expect(matrix).toBeGreaterThan(historical);
  });
});
