import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("Phase 8 CI validation ordering", () => {
  it("runs npm audit before executable validation and keeps the benchmark sequence stable", async () => {
    const workflow = (await readFile(join(process.cwd(), ".github/workflows/ci.yml"), "utf8"))
      .replace(/\r\n/g, "\n");
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

  it("isolates the production browser diagnostic from the preview ChromeDriver port", async () => {
    const workflow = (await readFile(join(process.cwd(), ".github/workflows/ci.yml"), "utf8"))
      .replace(/\r\n/g, "\n");
    const productionSmoke = await readFile(
      join(process.cwd(), "tests/browser/production-ui-smoke.mjs"),
      "utf8",
    );

    expect(workflow).toContain("chromedriver --port=9515 --allowed-ips=");
    expect(workflow).toContain("SCOPEFORGE_WEBDRIVER_BASE_URL: http://127.0.0.1:9516");
    expect(workflow).toContain("chromedriver --port=9516 --allowed-ips=");
    expect(workflow).toContain("curl --fail --silent http://127.0.0.1:9516/status");
    expect(productionSmoke).toContain(
      'process.env.SCOPEFORGE_WEBDRIVER_BASE_URL || "http://127.0.0.1:9515"',
    );
  });
});
