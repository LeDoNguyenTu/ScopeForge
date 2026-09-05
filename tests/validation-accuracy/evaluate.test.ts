import { describe, expect, it } from "vitest";

import {
  classifyValidationCase,
  type ValidationCaseV1,
} from "@/packages/validation-accuracy";
import type { Finding, ScanError } from "@/packages/scanner-core/findings/types";
import { cleanCase, vulnerableCase } from "./task1-helpers";

function asCase(value: Record<string, unknown>): ValidationCaseV1 {
  return value as unknown as ValidationCaseV1;
}

function finding(
  ruleId: string,
  file = "src/app.ts",
  patch: Partial<Finding> = {},
): Finding {
  return {
    id: `finding-${ruleId}-${file}`,
    fingerprint: `fingerprint-${ruleId}-${file}`,
    scanner: ruleId.startsWith("iac/") ? "iac" : "jsts",
    ruleId,
    ruleVersion: "1.0.0",
    title: "Synthetic finding",
    description: "Synthetic validation finding.",
    severity: "medium",
    confidence: "high",
    category: "validation-test",
    validation: "static_confirmed",
    provenance: "observed",
    location: {
      file,
      startLine: 1,
      startColumn: 1,
      endLine: 1,
      endColumn: 2,
    },
    evidence: { summary: "synthetic" },
    cwe: ["CWE-95"],
    owasp: [],
    references: [],
    remediation: {
      summary: "Synthetic remediation.",
      guidance: "Synthetic guidance.",
      verification: "Synthetic verification.",
    },
    metadata: {},
    baselineState: "none",
    ...patch,
  };
}

function scanError(code?: string): ScanError {
  return {
    scanner: "jsts",
    ...(code ? { code } : {}),
    message: "hostile message must not be copied",
  };
}

const TARGET = "jsts/dynamic-code-execution";
const VULNERABLE = asCase(vulnerableCase("case-vulnerable", { expectedCwe: ["CWE-95"] }));
const CLEAN = asCase(cleanCase("case-clean"));

describe("validation case classification", () => {
  it("classifies vulnerable exact target finding in an expected file as TP", () => {
    expect(classifyValidationCase(VULNERABLE, [finding(TARGET)], [])).toMatchObject({
      kind: "tp",
      caseId: "case-vulnerable",
      ruleId: TARGET,
      contractMismatches: [],
      unexpectedRuleIds: [],
      diagnosticCodes: [],
    });
  });

  it("classifies vulnerable absence as FN", () => {
    expect(classifyValidationCase(VULNERABLE, [], [])).toMatchObject({ kind: "fn" });
  });

  it("classifies a clean target finding as FP and clean absence as TN", () => {
    expect(classifyValidationCase(CLEAN, [finding(TARGET)], [])).toMatchObject({ kind: "fp" });
    expect(classifyValidationCase(CLEAN, [], [])).toMatchObject({ kind: "tn" });
  });

  it("never converts scanner errors into FN or TN", () => {
    const outcome = classifyValidationCase(CLEAN, [], [scanError("syntax_error")]);
    expect(outcome).toMatchObject({
      kind: "error",
      diagnosticCodes: ["syntax_error"],
    });
    expect(JSON.stringify(outcome)).not.toContain("hostile message");
  });

  it("classifies known unsupported diagnostics separately", () => {
    expect(classifyValidationCase(VULNERABLE, [], [scanError("unsupported_binary_source")]))
      .toMatchObject({
        kind: "unsupported",
        diagnosticCodes: ["unsupported_binary_source"],
      });
  });

  it("does not credit the correct rule when it fires only in an unrelated file", () => {
    expect(classifyValidationCase(VULNERABLE, [finding(TARGET, "src/other.ts")], []))
      .toMatchObject({ kind: "fn" });
  });

  it("records other rules without satisfying the target rule", () => {
    const other = finding("jsts/command-injection");
    expect(classifyValidationCase(VULNERABLE, [other], [])).toMatchObject({
      kind: "fn",
      unexpectedRuleIds: ["jsts/command-injection"],
    });
    expect(classifyValidationCase(CLEAN, [other], [])).toMatchObject({
      kind: "tn",
      unexpectedRuleIds: ["jsts/command-injection"],
    });
  });

  it("deduplicates unexpected rules and does not inflate one case through duplicate findings", () => {
    const duplicateTarget = finding(TARGET);
    const duplicateTarget2 = finding(TARGET, "src/app.ts", {
      id: "finding-2",
      fingerprint: "fingerprint-2",
    });
    const other1 = finding("jsts/command-injection");
    const other2 = finding("jsts/command-injection", "src/other.ts");
    const outcome = classifyValidationCase(VULNERABLE, [duplicateTarget, duplicateTarget2, other2, other1], []);

    expect(outcome.kind).toBe("tp");
    expect(outcome.unexpectedRuleIds).toEqual(["jsts/command-injection"]);
  });

  it("keeps detection TP while recording severity, confidence, and CWE mismatches", () => {
    const mismatch = finding(TARGET, "src/app.ts", {
      severity: "high",
      confidence: "medium",
      cwe: ["CWE-78"],
    });
    expect(classifyValidationCase(VULNERABLE, [mismatch], [])).toMatchObject({
      kind: "tp",
      contractMismatches: ["confidence", "cwe", "severity"],
    });
  });

  it("treats an unknown diagnostic without a code as a fixed scanner error category", () => {
    expect(classifyValidationCase(CLEAN, [], [scanError()])).toMatchObject({
      kind: "error",
      diagnosticCodes: ["scanner_error"],
    });
  });
});
