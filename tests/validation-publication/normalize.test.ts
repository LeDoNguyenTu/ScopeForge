import { describe, expect, it } from "vitest";

import { normalizePublicationEvidence } from "@/packages/validation-publication";
import { evidenceFixture } from "./fixtures";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("Phase 8C publication normalization", () => {
  it("recomputes accuracy metrics and emits stable lexical ordering", () => {
    const fixture = evidenceFixture();
    fixture.accuracy.cases.reverse();
    fixture.performance.profiles.reverse();
    fixture.limitations.reverse();

    const normalized = normalizePublicationEvidence(fixture);

    expect(normalized.accuracy.aggregate.metrics).toEqual({
      precision: 1,
      recall: 1,
      falsePositiveRate: 0,
      f1: 1,
    });
    expect(normalized.accuracy.cases.map((item) => item.caseId)).toEqual(["clean-case", "vulnerable-case"]);
    expect(normalized.performance.profiles.map((item) => item.id)).toEqual([
      "dependency-lockfile-heavy-v1",
      "iac-heavy-v1",
      "source-ast-heavy-v1",
    ]);
    expect(normalized.limitations).toEqual([...normalized.limitations].sort());
  });

  it("rejects accuracy counts or metrics that disagree with case outcomes", () => {
    const countMismatch = evidenceFixture();
    countMismatch.accuracy.aggregate.counts.tp = 2;
    expect(() => normalizePublicationEvidence(countMismatch)).toThrow();

    const metricMismatch = evidenceFixture();
    metricMismatch.accuracy.aggregate.metrics.precision = 0.5;
    expect(() => normalizePublicationEvidence(metricMismatch)).toThrow();
  });

  it("keeps error, unsupported, and contract mismatch accounting explicit", () => {
    const fixture = evidenceFixture();
    const errorCase = clone(fixture.accuracy.cases[0]);
    errorCase.caseId = "error-case";
    errorCase.kind = "error";
    errorCase.diagnosticCodes = ["inventory_error"];
    fixture.accuracy.cases.push(errorCase);
    fixture.accuracy.coverage.totalCases = 3;
    fixture.accuracy.rules[0].caseIds.push("error-case");
    fixture.accuracy.rules[0].counts.error = 1;
    fixture.accuracy.aggregate.counts.error = 1;

    const normalized = normalizePublicationEvidence(fixture);
    expect(normalized.accuracy.aggregate.counts.error).toBe(1);
    expect(normalized.accuracy.cases.find((item) => item.caseId === "error-case")?.diagnosticCodes).toEqual(["inventory_error"]);
  });

  it("recomputes all benchmark summaries from the three retained raw runs", () => {
    const normalized = normalizePublicationEvidence(evidenceFixture());
    const dependency = normalized.performance.profiles.find((item) => item.id === "dependency-lockfile-heavy-v1");
    expect(dependency?.runs).toHaveLength(3);
    expect(dependency?.summary).toEqual({
      minWallMs: 2351,
      medianWallMs: 2392,
      maxWallMs: 2428,
      medianScanDurationMs: 2391,
      maxRssDeltaBytes: 4124672,
    });
  });

  it("rejects benchmark summaries that hide or alter raw variance", () => {
    const fixture = evidenceFixture();
    fixture.performance.profiles[0].summary.medianWallMs = 1;
    expect(() => normalizePublicationEvidence(fixture)).toThrow();
  });

  it("rejects benchmark runs that violate analyzed-file, finding, error, or ceiling contracts", () => {
    for (const mutation of ["files", "findings", "errors", "ceiling"] as const) {
      const fixture = evidenceFixture();
      const run = fixture.performance.profiles[0].runs[0];
      if (mutation === "files") run.filesAnalyzed = 2;
      if (mutation === "findings") run.findings = 1;
      if (mutation === "errors") run.errors = 1;
      if (mutation === "ceiling") run.wallMs = 20001;
      expect(() => normalizePublicationEvidence(fixture), mutation).toThrow();
    }
  });

  it("locks the three released Phase 8B profile definitions", () => {
    const fixture = evidenceFixture();
    fixture.performance.profiles[0].preflight = {
      kind: "dependency-lockfile",
      resolvedComponents: 4999,
      parserDiagnostics: 0,
      osvEnabled: false,
    };
    expect(() => normalizePublicationEvidence(fixture)).toThrow();

    const iac = evidenceFixture();
    iac.performance.profiles[1].expectedFindingRuleCounts["iac/docker-floating-base-image"] = 2;
    expect(() => normalizePublicationEvidence(iac)).toThrow();

    const source = evidenceFixture();
    source.performance.profiles[2].expectedFindingRuleCounts["jsts/dynamic-code-execution"] = 3;
    expect(() => normalizePublicationEvidence(source)).toThrow();
  });
});
