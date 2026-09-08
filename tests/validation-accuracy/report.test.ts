import { describe, expect, it } from "vitest";

import {
  renderValidationAccuracyMarkdown,
  serializeValidationAccuracyJson,
  type ValidationAccuracyResult,
} from "@/packages/validation-accuracy";

function resultFixture(): ValidationAccuracyResult {
  return {
    schemaVersion: 1,
    provenance: {
      scopeforgeVersion: "0.1.0",
      commitSha: "a".repeat(40),
      nodeVersion: "v22.0.0",
      platform: "linux",
      arch: "x64",
    },
    corpus: {
      id: "scopeforge-offline-v1",
      version: "1.0.0",
      contentHash: "b".repeat(64),
    },
    coverage: {
      totalCases: 2,
      representedScannerFamilies: ["jsts"],
      representedRuleIds: ["jsts/dynamic-code-execution"],
    },
    aggregate: {
      counts: {
        tp: 1,
        fn: 0,
        fp: 0,
        tn: 1,
        error: 0,
        unsupported: 0,
        contractMismatch: 0,
      },
      metrics: {
        precision: 1,
        recall: 1,
        falsePositiveRate: 0,
        f1: 1,
      },
    },
    rules: [{
      scanner: "jsts",
      ruleId: "jsts/dynamic-code-execution",
      ruleVersion: "1.0.0",
      caseIds: ["case-clean", "case-positive"],
      counts: {
        tp: 1,
        fn: 0,
        fp: 0,
        tn: 1,
        error: 0,
        unsupported: 0,
        contractMismatch: 0,
      },
      metrics: {
        precision: 1,
        recall: 1,
        falsePositiveRate: 0,
        f1: 1,
      },
    }],
    cases: [
      {
        caseId: "case-clean",
        scanner: "jsts",
        ruleId: "jsts/dynamic-code-execution",
        label: "clean",
        kind: "tn",
        contractMismatches: [],
        unexpectedRuleIds: [],
        diagnosticCodes: [],
      },
      {
        caseId: "case-positive",
        scanner: "jsts",
        ruleId: "jsts/dynamic-code-execution",
        label: "vulnerable",
        kind: "tp",
        contractMismatches: [],
        unexpectedRuleIds: [],
        diagnosticCodes: [],
      },
    ],
    interpretation: "Metrics describe only the committed covered corpus and are not global ScopeForge accuracy.",
  };
}

describe("validation accuracy reporting", () => {
  it("serializes normalized JSON deterministically with one trailing newline", () => {
    const first = serializeValidationAccuracyJson(resultFixture());
    const second = serializeValidationAccuracyJson(resultFixture());
    expect(first).toBe(second);
    expect(first.endsWith("\n")).toBe(true);
    expect(first.endsWith("\n\n")).toBe(false);
    expect(JSON.parse(first).schemaVersion).toBe(1);
  });

  it("renders deterministic Markdown from the normalized result", () => {
    const first = renderValidationAccuracyMarkdown(resultFixture());
    const second = renderValidationAccuracyMarkdown(resultFixture());
    expect(first).toBe(second);
    expect(first).toContain("# ScopeForge Offline Validation Report - scopeforge-offline-v1");
    expect(first).toContain("## Scope");
    expect(first).toContain("## Provenance");
    expect(first).toContain("## Coverage");
    expect(first).toContain("## Rule Results");
    expect(first).toContain("## Errors/Unsupported");
    expect(first).toContain("## Contract Mismatches");
    expect(first).toContain("## Unexpected Rules");
    expect(first).toContain("## Limitations");
    expect(first).toContain("100.00%");
    expect(first).toContain("covered corpus");
  });

  it("renders undefined metric denominators as n/a", () => {
    const result = resultFixture();
    result.aggregate.metrics.precision = null;
    result.aggregate.metrics.recall = null;
    result.aggregate.metrics.f1 = null;
    result.rules[0]!.metrics.precision = null;
    result.rules[0]!.metrics.recall = null;
    result.rules[0]!.metrics.f1 = null;
    const markdown = renderValidationAccuracyMarkdown(result);
    expect(markdown).toContain("n/a");
  });
});
