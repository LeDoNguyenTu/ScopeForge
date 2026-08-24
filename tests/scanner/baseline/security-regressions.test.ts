import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCli } from "@/packages/cli/run-cli";
import { loadBaseline } from "@/packages/scanner-core/baseline/load";
import { SCAN_EXIT } from "@/packages/scanner-core/policy/exit-codes";

const tempPaths: string[] = [];

async function tempDir(prefix: string) {
  const path = await mkdtemp(join(tmpdir(), prefix));
  tempPaths.push(path);
  return path;
}

function captureIo() {
  let stdout = "";
  let stderr = "";
  return {
    io: {
      stdout(value: string) { stdout += value; },
      stderr(value: string) { stderr += value; }
    },
    serialized: () => JSON.stringify({ stdout, stderr })
  };
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("baseline security regressions", () => {
  it("rejects unknown baseline fields without reflecting hostile baseline content", async () => {
    const root = await tempDir("scopeforge-baseline-hostile-");
    const sentinel = "HOSTILE_BASELINE_SENTINEL_6f12";
    await writeFile(
      join(root, "baseline.json"),
      JSON.stringify({
        version: 1,
        tool: { name: "ScopeForge", version: "0.1.0" },
        entries: [
          {
            fingerprint: `sf1:${"a".repeat(64)}`,
            scanner: "test",
            ruleId: "test/high",
            ruleVersion: "1.0.0",
            severity: "high",
            file: "src/a.ts",
            evidence: sentinel
          }
        ]
      })
    );

    await expect(loadBaseline(root, "baseline.json")).rejects.toMatchObject({ code: "invalid_baseline" });

    const capture = captureIo();
    expect(await runCli(["scan", root, "--baseline", "baseline.json"], { io: capture.io, scanners: [] })).toBe(
      SCAN_EXIT.USAGE_ERROR
    );
    expect(capture.serialized()).not.toContain(sentinel);
  });

  it("refuses a repository-configured baseline symlink that resolves outside the scan root", async () => {
    const root = await tempDir("scopeforge-baseline-symlink-root-");
    const outside = await tempDir("scopeforge-baseline-symlink-outside-");
    await writeFile(
      join(outside, "baseline.json"),
      JSON.stringify({ version: 1, tool: { name: "ScopeForge", version: "0.1.0" }, entries: [] })
    );
    await symlink(join(outside, "baseline.json"), join(root, "baseline.json"));
    await writeFile(join(root, ".scopeforge.json"), JSON.stringify({ version: 1, baseline: "baseline.json" }));

    const capture = captureIo();
    expect(await runCli(["scan", root], { io: capture.io, scanners: [] })).toBe(SCAN_EXIT.USAGE_ERROR);
    expect(capture.serialized()).toContain("Baseline");
  });
});
