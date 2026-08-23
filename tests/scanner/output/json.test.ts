import { describe, expect, it } from "vitest";

import { serializeScanResult } from "@/packages/scanner-output/json/serialize";
import type { Finding, ScanResult } from "@/packages/scanner-core/findings/types";

function makeFinding(
  fingerprint: string,
  severity: Finding["severity"],
  file: string,
  ruleId: string
): Finding {
  return {
    id: fingerprint,
    fingerprint,
    scanner: "test",
    ruleId,
    ruleVersion: "1.0.0",
    title: ruleId,
    description: `Finding for ${ruleId}`,
    severity,
    confidence: "high",
    category: "test",
    validation: "static_confirmed",
    provenance: "observed",
    location: {
      file,
      startLine: 5,
      startColumn: 1,
      endLine: 5,
      endColumn: 2
    },
    evidence: {
      summary: "safe evidence"
    },
    cwe: [],
    owasp: [],
    references: [],
    remediation: {
      summary: "Fix it",
      guidance: "Apply the safe pattern.",
      verification: "Run ScopeForge again."
    },
    metadata: {},
    baselineState: "new"
  };
}

const high = makeFinding("sf1:high", "high", "src/a.ts", "high-rule");
const low = makeFinding("sf1:low", "low", "src/z.ts", "low-rule");

const baseResult: Omit<ScanResult, "findings"> = {
  scan: {
    root: ".",
    startedAt: "2026-08-24T00:00:00.000Z",
    durationMs: 25,
    scanners: ["test@1.0.0"]
  },
  inventory: {
    filesAnalyzed: 2,
    filesSkipped: 1,
    totalBytes: 64,
    languages: {
      TypeScript: 2
    },
    manifests: ["package.json"],
    infrastructure: [],
    skippedByReason: {
      default_exclude: 1,
      gitignore: 0,
      scopeforgeignore: 0,
      symlink: 0,
      file_too_large: 0,
      file_limit: 0,
      total_bytes_limit: 0,
      unreadable: 0
    }
  },
  errors: [],
  policy: {
    mode: "report-only",
    passed: true
  }
};

describe("serializeScanResult", () => {
  it("emits the versioned ScopeForge JSON envelope", () => {
    const output = serializeScanResult(
      { ...baseResult, findings: [high, low] },
      { toolVersion: "0.1.0" }
    );
    const parsed = JSON.parse(output);

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.tool).toEqual({ name: "ScopeForge", version: "0.1.0" });
    expect(parsed.scan).toEqual(baseResult.scan);
    expect(parsed.inventory).toEqual(baseResult.inventory);
    expect(parsed.errors).toEqual([]);
    expect(parsed.policy).toEqual({ mode: "report-only", passed: true });
    expect(output.endsWith("\n")).toBe(true);
  });

  it("sorts findings so equivalent result sets serialize byte-for-byte identically", () => {
    const first = serializeScanResult(
      { ...baseResult, findings: [low, high] },
      { toolVersion: "0.1.0" }
    );
    const second = serializeScanResult(
      { ...baseResult, findings: [high, low] },
      { toolVersion: "0.1.0" }
    );

    expect(first).toBe(second);
    expect(JSON.parse(first).findings.map((finding: Finding) => finding.fingerprint)).toEqual([
      "sf1:high",
      "sf1:low"
    ]);
  });
});
