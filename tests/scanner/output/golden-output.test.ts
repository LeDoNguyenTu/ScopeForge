import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { formatTerminalResult } from "@/packages/cli/terminal";
import type { Finding, ScanResult } from "@/packages/scanner-core/findings/types";
import { serializeScanResult } from "@/packages/scanner-output/json/serialize";
import { serializeSarifResult } from "@/packages/scanner-output/sarif/serialize";

const fpA = `sf1:${"a".repeat(64)}`;
const fpB = `sf1:${"b".repeat(64)}`;

function findingA(): Finding {
  return {
    id: fpA,
    fingerprint: fpA,
    scanner: "jsts",
    ruleId: "jsts/command-injection",
    ruleVersion: "1.0.0",
    title: "Command injection",
    description: "Attacker-controlled request input reaches a command execution sink.",
    severity: "high",
    confidence: "high",
    category: "code",
    validation: "static_confirmed",
    provenance: "observed",
    location: { file: "src/app.ts", startLine: 7, startColumn: 3, endLine: 7, endColumn: 22 },
    evidence: {
      summary: "Observed a bounded Express request-input flow to child_process.exec.",
      redactedSnippet: "request input -> child_process.exec(...)"
    },
    cwe: ["CWE-78"],
    owasp: ["A03:2021"],
    references: [],
    remediation: {
      summary: "Avoid shell command construction from request input.",
      guidance: "Use a non-shell API with fixed executable and validated arguments.",
      verification: "Rescan and confirm the source-to-sink flow is absent."
    },
    metadata: { structuralContext: "Express handler -> child_process.exec" },
    baselineState: "new"
  };
}

function findingB(): Finding {
  return {
    id: fpB,
    fingerprint: fpB,
    scanner: "jsts",
    ruleId: "jsts/dynamic-code-execution",
    ruleVersion: "1.0.0",
    title: "Dynamic code execution",
    description: "A direct dynamic JavaScript execution construct is present.",
    severity: "medium",
    confidence: "high",
    category: "code",
    validation: "static_confirmed",
    provenance: "observed",
    location: { file: "src/legacy.ts", startLine: 3, startColumn: 1, endLine: 3, endColumn: 5 },
    evidence: { summary: "Observed direct eval invocation." },
    cwe: ["CWE-95"],
    owasp: ["A03:2021"],
    references: [],
    remediation: {
      summary: "Remove dynamic code evaluation.",
      guidance: "Replace eval with explicit parsing or dispatch logic.",
      verification: "Rescan and confirm the dynamic execution construct is absent."
    },
    metadata: { structuralContext: "top-level eval call" },
    baselineState: "existing"
  };
}

function fixedResult(): ScanResult {
  return {
    scan: {
      root: "./fixture",
      startedAt: "2026-08-24T00:00:00.000Z",
      durationMs: 123,
      scanners: ["secrets@1.0.0", "jsts@1.0.0"]
    },
    inventory: {
      filesAnalyzed: 2,
      filesSkipped: 1,
      totalBytes: 42,
      languages: { TypeScript: 2 },
      manifests: ["package-lock.json"],
      infrastructure: ["Dockerfile"],
      skippedByReason: {
        default_exclude: 0,
        gitignore: 0,
        scopeforgeignore: 0,
        symlink: 1,
        file_too_large: 0,
        file_limit: 0,
        total_bytes_limit: 0,
        unreadable: 0
      }
    },
    findings: [findingA(), findingB()],
    errors: [
      {
        scanner: "iac",
        code: "invalid_fixture",
        file: "deploy/broken.yaml",
        message: "Infrastructure fixture could not be analyzed."
      }
    ],
    policy: {
      mode: "enforce",
      passed: false,
      failOn: "high",
      baselineGate: "new"
    }
  };
}

async function golden(name: string): Promise<string> {
  return readFile(join(process.cwd(), "tests", "fixtures", "scanner", "golden", name), "utf8");
}

describe("Phase 3 golden output continuity", () => {
  it("matches committed native JSON exactly", async () => {
    const result = fixedResult();
    const rendered = serializeScanResult(result, { toolVersion: "0.1.0" });
    expect(rendered).toBe(await golden("scan-result.json"));
    expect(serializeScanResult(result, { toolVersion: "0.1.0" })).toBe(rendered);
  });

  it("matches committed SARIF exactly", async () => {
    const result = fixedResult();
    const rendered = serializeSarifResult(result, { toolVersion: "0.1.0" });
    expect(rendered).toBe(await golden("scan-result.sarif"));
    expect(serializeSarifResult(result, { toolVersion: "0.1.0" })).toBe(rendered);
  });

  it("matches committed terminal output exactly", async () => {
    const result = fixedResult();
    const rendered = formatTerminalResult(result, { baselineActive: true });
    expect(rendered).toBe(await golden("scan-result.txt"));
    expect(formatTerminalResult(result, { baselineActive: true })).toBe(rendered);
  });
});
