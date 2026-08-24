import { describe, expect, it } from "vitest";

import { applyBaseline } from "@/packages/scanner-core/baseline/apply";
import type { BaselineFile } from "@/packages/scanner-core/baseline/types";
import type { Finding } from "@/packages/scanner-core/findings/types";

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
    location: { file: "src/a.ts", startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
    evidence: { summary: "safe" },
    cwe: [],
    owasp: [],
    references: [],
    remediation: { summary: "fix", guidance: "fix", verification: "rescan" },
    metadata: {},
    baselineState: "none"
  };
}

describe("resolved baseline entries", () => {
  it("returns resolved baseline entries separately from current findings", () => {
    const current = finding(`sf1:${"a".repeat(64)}`);
    const resolvedFingerprint = `sf1:${"b".repeat(64)}`;
    const baseline: BaselineFile = {
      version: 1,
      tool: { name: "ScopeForge", version: "0.1.0" },
      entries: [
        {
          fingerprint: current.fingerprint,
          scanner: "test",
          ruleId: "test/high",
          ruleVersion: "1.0.0",
          severity: "high",
          file: "src/a.ts"
        },
        {
          fingerprint: resolvedFingerprint,
          scanner: "test",
          ruleId: "test/high",
          ruleVersion: "1.0.0",
          severity: "high",
          file: "src/resolved.ts"
        }
      ]
    };

    const result = applyBaseline([current], baseline);
    expect(result.findings[0]?.baselineState).toBe("existing");
    expect(result.resolved).toEqual([
      expect.objectContaining({ fingerprint: resolvedFingerprint, file: "src/resolved.ts" })
    ]);
  });
});
