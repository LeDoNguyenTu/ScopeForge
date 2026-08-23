import { describe, expect, it } from "vitest";

import { evaluatePolicy, resolveScanExitCode } from "@/packages/scanner-core/policy/evaluate-policy";
import { SCAN_EXIT } from "@/packages/scanner-core/policy/exit-codes";
import type { Finding, Severity } from "@/packages/scanner-core/findings/types";

function finding(severity: Severity, baselineState: Finding["baselineState"] = "new"): Finding {
  const fingerprint = `sf1:${severity}:${baselineState}`;
  return {
    id: fingerprint,
    fingerprint,
    scanner: "test",
    ruleId: `test/${severity}`,
    ruleVersion: "1.0.0",
    title: `${severity} finding`,
    description: "test",
    severity,
    confidence: "high",
    category: "test",
    validation: "static_confirmed",
    provenance: "observed",
    location: { file: "src/a.ts", startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
    evidence: { summary: "test" },
    cwe: [],
    owasp: [],
    references: [],
    remediation: { summary: "fix", guidance: "fix", verification: "rescan" },
    metadata: {},
    baselineState
  };
}

describe("evaluatePolicy", () => {
  it("is report-only by default", () => {
    expect(evaluatePolicy([finding("critical")])).toEqual({ mode: "report-only", passed: true });
  });

  it("uses an inclusive severity threshold and ignores existing baseline findings", () => {
    expect(evaluatePolicy([finding("high")], "high")).toEqual({
      mode: "enforce",
      passed: false,
      failOn: "high"
    });
    expect(evaluatePolicy([finding("medium")], "high").passed).toBe(true);
    expect(evaluatePolicy([finding("critical", "existing")], "high").passed).toBe(true);
  });

  it("keeps scanner execution failures distinct from policy failures", () => {
    expect(resolveScanExitCode({ errors: [{ scanner: "broken", message: "failed" }], policyPassed: false })).toBe(
      SCAN_EXIT.SCANNER_ERROR
    );
    expect(resolveScanExitCode({ errors: [], policyPassed: false })).toBe(SCAN_EXIT.POLICY_FAILED);
    expect(resolveScanExitCode({ errors: [], policyPassed: true })).toBe(SCAN_EXIT.SUCCESS);
  });
});
