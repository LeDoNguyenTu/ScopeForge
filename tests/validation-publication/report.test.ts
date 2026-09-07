import { describe, expect, it } from "vitest";

import {
  normalizePublicationEvidence,
  renderTechnicalPublicationMarkdown,
  serializeTechnicalPublicationJson,
} from "@/packages/validation-publication";
import { evidenceFixture } from "./fixtures";

describe("Phase 8C technical publication renderers", () => {
  it("serializes canonical JSON deterministically with one trailing newline", () => {
    const result = normalizePublicationEvidence(evidenceFixture() as any);
    const first = serializeTechnicalPublicationJson(result);
    const second = serializeTechnicalPublicationJson(result);
    expect(first).toBe(second);
    expect(first.endsWith("\n")).toBe(true);
    expect(first.endsWith("\n\n")).toBe(false);
    expect(JSON.parse(first).publicationId).toBe("scopeforge-phase-8-release-v1");
  });

  it("renders every publication evidence section from the normalized object", () => {
    const report = renderTechnicalPublicationMarkdown(
      normalizePublicationEvidence(evidenceFixture() as any),
    );

    for (const heading of [
      "## Scope and Claim Boundaries",
      "## Provenance",
      "## Accuracy Evidence",
      "## Rule Results",
      "## Exceptional Accuracy Outcomes",
      "## Performance Environment",
      "## Historical Benchmark Continuity",
      "## Performance Matrix",
      "## Limitations",
      "## Unsupported Scenarios",
      "## Reproduction",
      "## Authority Boundary",
    ]) {
      expect(report).toContain(heading);
    }

    expect(report).toContain("scopeforge-offline-v1@1.0.0");
    expect(report).toContain("dependency-lockfile-heavy-v1");
    expect(report).toContain("iac-heavy-v1");
    expect(report).toContain("source-ast-heavy-v1");
    expect(report).toContain("Run | Files | Findings | Errors | Scanner ms | Wall ms | RSS delta bytes");
    expect(report).toContain("Catastrophic benchmark ceilings are regression guards, not product latency SLOs.");
    expect(report).toContain("RSS delta is observational and is not peak RSS or a memory limit.");
  });

  it("renders fixed metric formatting without inventing zero-denominator values", () => {
    const fixture = evidenceFixture();
    fixture.accuracy.cases = [];
    fixture.accuracy.rules = [];
    fixture.accuracy.coverage.totalCases = 0;
    fixture.accuracy.coverage.representedScannerFamilies = [];
    fixture.accuracy.coverage.representedRuleIds = [];
    fixture.accuracy.aggregate.counts = { tp: 0, fn: 0, fp: 0, tn: 0, error: 0, unsupported: 0, contractMismatch: 0 };
    fixture.accuracy.aggregate.metrics = { precision: null, recall: null, falsePositiveRate: null, f1: null };

    const report = renderTechnicalPublicationMarkdown(normalizePublicationEvidence(fixture as any));
    expect(report).toContain("Precision: n/a");
    expect(report).toContain("Recall: n/a");
    expect(report).toContain("False-positive rate: n/a");
    expect(report).toContain("F1: n/a");
  });

  it("retains every raw benchmark run rather than publishing only a best run", () => {
    const report = renderTechnicalPublicationMarkdown(
      normalizePublicationEvidence(evidenceFixture() as any),
    );
    expect(report).toContain("| 1 | 3 | 0 | 0 | 2426 | 2428 | 1241088 |");
    expect(report).toContain("| 2 | 3 | 0 | 0 | 2391 | 2392 | 4124672 |");
    expect(report).toContain("| 3 | 3 | 0 | 0 | 2350 | 2351 | 3100672 |");
  });
});
