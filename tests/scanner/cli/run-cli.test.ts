import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCli } from "@/packages/cli/run-cli";
import { SCAN_EXIT } from "@/packages/scanner-core/policy/exit-codes";
import type { Scanner } from "@/packages/scanner-core/coordinator/types";
import type { Finding } from "@/packages/scanner-core/findings/types";

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
      stdout: (value: string) => {
        stdout += value;
      },
      stderr: (value: string) => {
        stderr += value;
      }
    },
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    }
  };
}

function highFinding(): Finding {
  return {
    id: "sf1:cli-high",
    fingerprint: "sf1:cli-high",
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
    evidence: { summary: "test" },
    cwe: [],
    owasp: [],
    references: [],
    remediation: { summary: "fix", guidance: "fix", verification: "rescan" },
    metadata: {},
    baselineState: "new"
  };
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("runCli", () => {
  it("supports version and rules list", async () => {
    const version = captureIo();
    expect(await runCli(["version"], { io: version.io })).toBe(SCAN_EXIT.SUCCESS);
    expect(version.stdout).toContain("ScopeForge 0.1.0");

    const rules = captureIo();
    expect(await runCli(["rules", "list"], { io: rules.io })).toBe(SCAN_EXIT.SUCCESS);
    expect(rules.stdout).toContain("No detector rules registered");
  });

  it("scans a repository in terminal and JSON modes", async () => {
    const root = await tempDir("scopeforge-cli-");
    await writeFile(join(root, "a.txt"), "hello\n");

    const terminal = captureIo();
    expect(await runCli(["scan", root], { io: terminal.io })).toBe(SCAN_EXIT.SUCCESS);
    expect(terminal.stdout).toContain("ScopeForge scan");
    expect(terminal.stdout).toContain("1 analyzed");
    expect(terminal.stdout).toContain("Policy: report-only");

    const json = captureIo();
    expect(await runCli(["scan", root, "--format", "json"], { io: json.io })).toBe(SCAN_EXIT.SUCCESS);
    expect(JSON.parse(json.stdout).schemaVersion).toBe(1);
  });

  it("writes JSON output to the requested file", async () => {
    const root = await tempDir("scopeforge-cli-output-");
    const outputPath = join(root, "result.json");
    await writeFile(join(root, "a.txt"), "hello\n");

    const capture = captureIo();
    expect(
      await runCli(["scan", root, "--format", "json", "--output", outputPath], { io: capture.io })
    ).toBe(SCAN_EXIT.SUCCESS);

    expect(JSON.parse(await readFile(outputPath, "utf8")).schemaVersion).toBe(1);
  });

  it("refuses to follow a configured output symlink", async () => {
    const root = await tempDir("scopeforge-cli-safe-output-");
    const outside = await tempDir("scopeforge-cli-safe-output-outside-");
    const victim = join(outside, "victim.txt");

    await writeFile(join(root, "a.txt"), "hello\n");
    await writeFile(victim, "preserve me\n");
    await symlink(victim, join(root, "result.json"));
    await writeFile(
      join(root, ".scopeforge.json"),
      JSON.stringify({ version: 1, output: { format: "json", path: "result.json" } })
    );

    const capture = captureIo();
    expect(await runCli(["scan", root], { io: capture.io })).toBe(SCAN_EXIT.USAGE_ERROR);
    expect(await readFile(victim, "utf8")).toBe("preserve me\n");
    expect(capture.stderr).toContain("output");
  });

  it("returns distinct policy, scanner, and usage exit codes", async () => {
    const root = await tempDir("scopeforge-cli-exit-");
    await writeFile(join(root, "a.txt"), "hello\n");

    const findingScanner: Scanner = {
      name: "test",
      version: "1.0.0",
      scan: async () => [highFinding()]
    };
    const policy = captureIo();
    expect(
      await runCli(["scan", root, "--fail-on", "high"], { io: policy.io, scanners: [findingScanner] })
    ).toBe(SCAN_EXIT.POLICY_FAILED);

    const brokenScanner: Scanner = {
      name: "broken",
      version: "1.0.0",
      scan: async () => {
        throw new Error("safe failure");
      }
    };
    const broken = captureIo();
    expect(await runCli(["scan", root], { io: broken.io, scanners: [brokenScanner] })).toBe(
      SCAN_EXIT.SCANNER_ERROR
    );

    const invalid = captureIo();
    expect(await runCli(["scan", root, "--fail-on", "severe"], { io: invalid.io })).toBe(
      SCAN_EXIT.USAGE_ERROR
    );
    expect(invalid.stderr).toContain("Invalid severity");
  });
});
