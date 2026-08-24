import { afterEach, describe, expect, it } from "vitest";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
  let stderr = "";
  return {
    io: {
      stdout(value: string) { stdout += value; },
      stderr(value: string) { stderr += value; }
    },
    stdout: () => stdout,
    stderr: () => stderr
  };
}

function finding(fingerprint: string, file = "src/a.ts"): Finding {
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
    location: { file, startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
    evidence: { summary: "safe generic evidence" },
    cwe: [],
    owasp: [],
    references: [],
    remediation: { summary: "fix", guidance: "fix", verification: "rescan" },
    metadata: {},
    baselineState: "none"
  };
}

function scanner(findings: Finding[]): Scanner {
  return {
    name: "test",
    version: "1.0.0",
    scan: async () => findings
  };
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("baseline CLI", () => {
  it("creates a deterministic baseline in the scan root and never serializes finding evidence", async () => {
    const root = await tempDir("scopeforge-baseline-cli-create-");
    await writeFile(join(root, "a.txt"), "hello\n");
    const sentinel = "BASELINE_SECRET_SENTINEL_4c81";
    const baseFinding = finding(`sf1:${"a".repeat(64)}`);
    baseFinding.evidence = { summary: sentinel };
    const capture = captureIo();

    expect(await runCli(["baseline", "create", root], { io: capture.io, scanners: [scanner([baseFinding])] })).toBe(
      SCAN_EXIT.SUCCESS
    );

    const baseline = await readFile(join(root, ".scopeforge-baseline.json"), "utf8");
    expect(JSON.parse(baseline).version).toBe(1);
    expect(JSON.parse(baseline).entries).toHaveLength(1);
    expect(baseline).not.toContain(sentinel);
    expect(capture.stdout()).toContain(".scopeforge-baseline.json");
  });

  it("labels matching findings existing, labels unmatched findings new, and gates new findings by default", async () => {
    const root = await tempDir("scopeforge-baseline-cli-apply-");
    await writeFile(join(root, "a.txt"), "hello\n");
    const existing = finding(`sf1:${"b".repeat(64)}`);

    expect(await runCli(["baseline", "create", root], { io: captureIo().io, scanners: [scanner([existing])] })).toBe(
      SCAN_EXIT.SUCCESS
    );

    const existingOnly = captureIo();
    expect(
      await runCli(
        ["scan", root, "--baseline", ".scopeforge-baseline.json", "--format", "json", "--fail-on", "high"],
        { io: existingOnly.io, scanners: [scanner([existing])] }
      )
    ).toBe(SCAN_EXIT.SUCCESS);
    const existingResult = JSON.parse(existingOnly.stdout());
    expect(existingResult.findings[0].baselineState).toBe("existing");
    expect(existingResult.policy).toMatchObject({ passed: true, baselineGate: "new" });

    const fresh = finding(`sf1:${"c".repeat(64)}`, "src/new.ts");
    const withNew = captureIo();
    expect(
      await runCli(
        ["scan", root, "--baseline", ".scopeforge-baseline.json", "--format", "json", "--fail-on", "high"],
        { io: withNew.io, scanners: [scanner([existing, fresh])] }
      )
    ).toBe(SCAN_EXIT.POLICY_FAILED);
    expect(JSON.parse(withNew.stdout()).findings.map((item: Finding) => item.baselineState).sort()).toEqual([
      "existing",
      "new"
    ]);
  });

  it("supports explicit all-finding policy gating when a baseline is active", async () => {
    const root = await tempDir("scopeforge-baseline-cli-all-");
    await writeFile(join(root, "a.txt"), "hello\n");
    const existing = finding(`sf1:${"d".repeat(64)}`);
    expect(await runCli(["baseline", "create", root], { io: captureIo().io, scanners: [scanner([existing])] })).toBe(
      SCAN_EXIT.SUCCESS
    );

    const capture = captureIo();
    expect(
      await runCli(
        [
          "scan",
          root,
          "--baseline",
          ".scopeforge-baseline.json",
          "--baseline-gate",
          "all",
          "--fail-on",
          "high"
        ],
        { io: capture.io, scanners: [scanner([existing])] }
      )
    ).toBe(SCAN_EXIT.POLICY_FAILED);
    expect(capture.stdout()).toContain("baseline all");
  });

  it("loads repository-configured baselines and lets an explicit CLI baseline override them", async () => {
    const root = await tempDir("scopeforge-baseline-cli-config-");
    await writeFile(join(root, "a.txt"), "hello\n");
    const first = finding(`sf1:${"e".repeat(64)}`);
    const second = finding(`sf1:${"f".repeat(64)}`);

    expect(await runCli(["baseline", "create", root], { io: captureIo().io, scanners: [scanner([first])] })).toBe(
      SCAN_EXIT.SUCCESS
    );
    await writeFile(join(root, "configured.json"), await readFile(join(root, ".scopeforge-baseline.json"), "utf8"));
    expect(await runCli(["baseline", "create", root], { io: captureIo().io, scanners: [scanner([second])] })).toBe(
      SCAN_EXIT.SUCCESS
    );
    await writeFile(join(root, ".scopeforge.json"), JSON.stringify({ version: 1, baseline: "configured.json" }));

    const configured = captureIo();
    expect(await runCli(["scan", root, "--format", "json"], { io: configured.io, scanners: [scanner([first])] })).toBe(
      SCAN_EXIT.SUCCESS
    );
    expect(JSON.parse(configured.stdout()).findings[0].baselineState).toBe("existing");

    const overridden = captureIo();
    expect(
      await runCli(
        ["scan", root, "--baseline", ".scopeforge-baseline.json", "--format", "json"],
        { io: overridden.io, scanners: [scanner([first])] }
      )
    ).toBe(SCAN_EXIT.SUCCESS);
    expect(JSON.parse(overridden.stdout()).findings[0].baselineState).toBe("new");
  });

  it("fails closed on malformed baselines and never creates a baseline from an incomplete scan", async () => {
    const root = await tempDir("scopeforge-baseline-cli-errors-");
    await writeFile(join(root, "a.txt"), "hello\n");
    await writeFile(join(root, "bad.json"), "{ invalid json");

    const invalid = captureIo();
    expect(await runCli(["scan", root, "--baseline", "bad.json"], { io: invalid.io, scanners: [] })).toBe(
      SCAN_EXIT.USAGE_ERROR
    );
    expect(invalid.stderr()).toContain("Baseline");

    const broken: Scanner = {
      name: "broken",
      version: "1.0.0",
      scan: async () => {
        throw new Error("scanner failed");
      }
    };
    const create = captureIo();
    expect(await runCli(["baseline", "create", root], { io: create.io, scanners: [broken] })).toBe(
      SCAN_EXIT.SCANNER_ERROR
    );
    await expect(access(join(root, ".scopeforge-baseline.json"))).rejects.toBeTruthy();
  });
});
