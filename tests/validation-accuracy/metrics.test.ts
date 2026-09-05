import { describe, expect, it } from "vitest";

import {
  aggregateValidationResult,
  computeDerivedMetrics,
  evaluateValidationCorpus,
  loadValidationCorpus,
  type LoadedValidationCorpus,
  type ValidationCaseOutcome,
  type ValidationProvenance,
} from "@/packages/validation-accuracy";
import { vulnerableCase, writeCorpus } from "./task1-helpers";

const PROVENANCE: ValidationProvenance = {
  scopeforgeVersion: "0.1.0",
  commitSha: "a".repeat(40),
  nodeVersion: "v22.0.0",
  platform: "linux",
  arch: "x64",
};

function outcome(
  caseId: string,
  ruleId: string,
  kind: ValidationCaseOutcome["kind"],
  patch: Partial<ValidationCaseOutcome> = {},
): ValidationCaseOutcome {
  return {
    caseId,
    scanner: ruleId.startsWith("iac/") ? "iac" : "jsts",
    ruleId,
    label: kind === "fp" || kind === "tn" ? "clean" : "vulnerable",
    kind,
    contractMismatches: [],
    unexpectedRuleIds: [],
    diagnosticCodes: [],
    ...patch,
  };
}

function corpusFor(outcomes: readonly ValidationCaseOutcome[]): LoadedValidationCorpus {
  return {
    corpusDirectory: "/trusted/corpus",
    manifestPath: "/trusted/corpus/corpus.json",
    manifest: {
      schemaVersion: 1,
      corpusId: "scopeforge-offline-v1",
      corpusVersion: "1.0.0",
      cases: outcomes.map((item) => `cases/${item.caseId}`),
    },
    cases: outcomes.map((item) => ({
      caseDirectory: `/trusted/corpus/cases/${item.caseId}`,
      repositoryDirectory: `/trusted/corpus/cases/${item.caseId}/repository`,
      manifestPath: `/trusted/corpus/cases/${item.caseId}/case.json`,
      manifest: {
        schemaVersion: 1,
        caseId: item.caseId,
        scanner: item.scanner,
        ruleId: item.ruleId,
        label: item.label,
        repository: "repository",
        rationale: "Synthetic aggregation fixture.",
        expectedFiles: item.label === "vulnerable" ? ["src/app.ts"] : [],
        ...(item.label === "vulnerable"
          ? { expectedSeverity: "medium" as const, expectedConfidence: "high" as const }
          : {}),
      },
    })),
    contentHash: "b".repeat(64),
  };
}

describe("validation accuracy metrics", () => {
  it("computes derived metrics from complete raw counts", () => {
    expect(computeDerivedMetrics({
      tp: 8,
      fn: 2,
      fp: 1,
      tn: 9,
      error: 3,
      unsupported: 4,
      contractMismatch: 2,
    })).toEqual({
      precision: 8 / 9,
      recall: 0.8,
      falsePositiveRate: 0.1,
      f1: 16 / 19,
    });
  });

  it("uses null for undefined denominators instead of invented scores", () => {
    expect(computeDerivedMetrics({
      tp: 0,
      fn: 0,
      fp: 0,
      tn: 4,
      error: 1,
      unsupported: 2,
      contractMismatch: 0,
    })).toEqual({
      precision: null,
      recall: null,
      falsePositiveRate: 0,
      f1: null,
    });
  });

  it("aggregates raw counts deterministically and excludes error/unsupported from derived denominators", () => {
    const outcomes = [
      outcome("case-z", "jsts/dynamic-code-execution", "unsupported", { diagnosticCodes: ["unsupported_binary_source"] }),
      outcome("case-b", "jsts/dynamic-code-execution", "fp", { label: "clean" }),
      outcome("case-y", "jsts/dynamic-code-execution", "error", { diagnosticCodes: ["syntax_error"] }),
      outcome("case-a", "jsts/dynamic-code-execution", "tp", { contractMismatches: ["severity"] }),
      outcome("case-c", "jsts/dynamic-code-execution", "fn"),
      outcome("case-d", "jsts/dynamic-code-execution", "tn", { label: "clean" }),
    ];

    const result = aggregateValidationResult(corpusFor(outcomes), [...outcomes].reverse(), PROVENANCE);

    expect(result.aggregate.counts).toEqual({
      tp: 1,
      fn: 1,
      fp: 1,
      tn: 1,
      error: 1,
      unsupported: 1,
      contractMismatch: 1,
    });
    expect(result.aggregate.metrics).toEqual({
      precision: 0.5,
      recall: 0.5,
      falsePositiveRate: 0.5,
      f1: 0.5,
    });
    expect(result.cases.map((item) => item.caseId)).toEqual([
      "case-a",
      "case-b",
      "case-c",
      "case-d",
      "case-y",
      "case-z",
    ]);
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]).toMatchObject({
      scanner: "jsts",
      ruleId: "jsts/dynamic-code-execution",
      ruleVersion: "1.0.0",
    });
    expect(result.coverage.representedScannerFamilies).toEqual(["jsts"]);
    expect(result.coverage.representedRuleIds).toEqual(["jsts/dynamic-code-execution"]);
    expect(result.interpretation).toBe(
      "Metrics describe only the committed covered corpus and are not global ScopeForge accuracy.",
    );
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.rules)).toBe(true);
    expect(Object.isFrozen(result.cases)).toBe(true);
  });

  it("produces identical aggregation from shuffled equivalent input", () => {
    const outcomes = [
      outcome("case-b", "jsts/dynamic-code-execution", "tn", { label: "clean" }),
      outcome("case-a", "jsts/dynamic-code-execution", "tp"),
    ];
    const corpus = corpusFor(outcomes);
    const first = aggregateValidationResult(corpus, outcomes, PROVENANCE);
    const second = aggregateValidationResult(corpus, [...outcomes].reverse(), PROVENANCE);
    expect(first).toEqual(second);
  });

  it("evaluates a real local case then aggregates it without timestamps", async () => {
    const root = await writeCorpus([
      {
        directory: "cases/jsts-dynamic-positive-eval",
        manifest: vulnerableCase("jsts-dynamic-positive-eval"),
        files: { "src/app.ts": "eval(input);\n" },
      },
    ]);
    const corpus = await loadValidationCorpus(root);
    const result = await evaluateValidationCorpus(corpus, PROVENANCE);

    expect(result.coverage.totalCases).toBe(1);
    expect(result.aggregate.counts).toMatchObject({ tp: 1, error: 0, unsupported: 0 });
    expect(result.cases[0]?.kind).toBe("tp");
    expect(JSON.stringify(result)).not.toContain("startedAt");
    expect(JSON.stringify(result)).not.toContain("durationMs");
    expect(JSON.stringify(result)).not.toContain(root);
  });
});
