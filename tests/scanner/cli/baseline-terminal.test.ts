import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCli } from "@/packages/cli/run-cli";
import type { Scanner } from "@/packages/scanner-core/coordinator/types";
import type { Finding } from "@/packages/scanner-core/findings/types";
import { SCAN_EXIT } from "@/packages/scanner-core/policy/exit-codes";

const tempPaths: string[] = [];

async function tempDir(prefix: string) {
  const path = await mkdtemp(join(tmpdir(), prefix));
  tempPaths.push(path);
  return path;
}

function captureIo() {
  let stdout = "";
  return {
    io: { stdout(value: string) { stdout += value; }, stderr(_value: string) {} },
    stdout: () => stdout
  };
}

function finding(fingerprint: string): Finding {
  return {
    id: fingerprint,
    fingerprint,
    scanner: "test",
    ruleId: "test/high",
    ruleVersion: "1.0.0",
    title: "High test finding",
    description: "test",
    severity: "high",
    confidence: "high",
    category: "test",
    validation: "static_confirmed",
    provenance: "observed",
    location: { file: "a.txt", startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
    evidence: { summary: "safe" },
    cwe: [],
    owasp: [],
    references: [],
    remediation: { summary: "fix", guidance: "fix", verification: "rescan" },
    metadata: {},
    baselineState: "none"
  };
}

function scanner(items: Finding[]): Scanner {
  return { name: "test", version: "1.0.0", scan: async () => items };
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("baseline terminal output", () => {
  it("shows new and existing counts only when a baseline is active", async () => {
    const root = await tempDir("scopeforge-baseline-terminal-");
    await writeFile(join(root, "a.txt"), "hello\n");
    const existing = finding(`sf1:${"a".repeat(64)}`);
    expect(await runCli(["baseline", "create", root], { io: captureIo().io, scanners: [scanner([existing])] })).toBe(
      SCAN_EXIT.SUCCESS
    );

    const withBaseline = captureIo();
    expect(
      await runCli(["scan", root, "--baseline", ".scopeforge-baseline.json"], {
        io: withBaseline.io,
        scanners: [scanner([existing])]
      })
    ).toBe(SCAN_EXIT.SUCCESS);
    expect(withBaseline.stdout()).toContain("Baseline: 0 new, 1 existing");

    const withoutBaseline = captureIo();
    expect(await runCli(["scan", root], { io: withoutBaseline.io, scanners: [scanner([existing])] })).toBe(
      SCAN_EXIT.SUCCESS
    );
    expect(withoutBaseline.stdout()).not.toContain("Baseline:");
  });
});
