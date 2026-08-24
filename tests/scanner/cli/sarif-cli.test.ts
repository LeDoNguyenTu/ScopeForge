import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
    id: `sf1:${"f".repeat(64)}`,
    fingerprint: `sf1:${"f".repeat(64)}`,
    scanner: "test",
    ruleId: "test/high",
    ruleVersion: "1.0.0",
    title: "High test finding",
    description: "A high severity test finding.",
    severity: "high",
    confidence: "high",
    category: "test",
    validation: "static_confirmed",
    provenance: "observed",
    location: { file: "a.txt", startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
    evidence: { summary: "Observed a normalized test condition." },
    cwe: ["CWE-20"],
    owasp: [],
    references: [],
    remediation: {
      summary: "Fix the test condition.",
      guidance: "Use the safe test pattern.",
      verification: "Run ScopeForge again."
    },
    metadata: {},
    baselineState: "new"
  };
}

function scanner(): Scanner {
  return {
    name: "test",
    version: "1.0.0",
    scan: async () => [highFinding()]
  };
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("SARIF CLI integration", () => {
  it("emits SARIF to stdout while report-only findings keep a successful exit code", async () => {
    const root = await tempDir("scopeforge-sarif-cli-");
    await writeFile(join(root, "a.txt"), "safe fixture\n");
    const capture = captureIo();

    expect(
      await runCli(["scan", root, "--format", "sarif"], {
        io: capture.io,
        scanners: [scanner()]
      })
    ).toBe(SCAN_EXIT.SUCCESS);

    const parsed = JSON.parse(capture.stdout);
    expect(parsed.version).toBe("2.1.0");
    expect(parsed.runs[0].results[0].ruleId).toBe("test/high");
    expect(capture.stderr).toBe("");
  });

  it("writes SARIF through the existing safe output path", async () => {
    const root = await tempDir("scopeforge-sarif-file-");
    await writeFile(join(root, "a.txt"), "safe fixture\n");
    const output = join(root, "scopeforge.sarif");
    const capture = captureIo();

    expect(
      await runCli(["scan", root, "--format", "sarif", "--output", output], {
        io: capture.io,
        scanners: [scanner()]
      })
    ).toBe(SCAN_EXIT.SUCCESS);

    expect(JSON.parse(await readFile(output, "utf8")).version).toBe("2.1.0");
    expect(capture.stdout).toBe("");
  });

  it("preserves policy failure semantics in SARIF mode", async () => {
    const root = await tempDir("scopeforge-sarif-policy-");
    await writeFile(join(root, "a.txt"), "safe fixture\n");
    const capture = captureIo();

    expect(
      await runCli(["scan", root, "--format", "sarif", "--fail-on", "high"], {
        io: capture.io,
        scanners: [scanner()]
      })
    ).toBe(SCAN_EXIT.POLICY_FAILED);
    expect(JSON.parse(capture.stdout).version).toBe("2.1.0");
  });

  it("rejects unknown output formats as usage errors", async () => {
    const root = await tempDir("scopeforge-sarif-invalid-format-");
    await writeFile(join(root, "a.txt"), "safe fixture\n");
    const capture = captureIo();

    expect(await runCli(["scan", root, "--format", "yaml"], { io: capture.io })).toBe(
      SCAN_EXIT.USAGE_ERROR
    );
    expect(capture.stderr).toContain("terminal, json, or sarif");
  });
});
