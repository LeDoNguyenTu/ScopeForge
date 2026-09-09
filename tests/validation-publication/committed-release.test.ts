import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  normalizePublicationEvidence,
  parsePublicationEvidence,
  renderTechnicalPublicationMarkdown,
  serializeTechnicalPublicationJson,
} from "@/packages/validation-publication";

const EVIDENCE = join(process.cwd(), "validation", "publication", "phase-8-release-v1.evidence.json");
const MARKDOWN_REPORT = join(process.cwd(), "docs", "validation", "reports", "phase-8-release-v1.md");

describe("committed Phase 8 technical publication", () => {
  it("locks the accepted Phase 8A and Phase 8B release evidence", async () => {
    const evidence = parsePublicationEvidence(await readFile(EVIDENCE, "utf8"));
    const result = normalizePublicationEvidence(evidence);

    expect(result.source).toMatchObject({
      phase8aCommit: "8d766f5969427a2e4525f5232b5e28b0f93675bd",
      phase8aTree: "aa6d94c2a35973ee2c8ccbc038d22d7de4f48cc8",
      phase8bCommit: "226a20739871c15d0262d1779b3b013520f47fc6",
      phase8bTree: "50f17f44e770f1179ed2b40b7713e14e864958c0",
      scopeforgeVersion: "0.1.0",
    });
    expect(result.accuracy.corpus).toEqual({
      id: "scopeforge-offline-v1",
      version: "1.0.0",
      contentHash: "3586e2b55cb2e20be5f19997eab7758eef0dcfb7391731b86bc1bdf9bcdd399f",
    });
    expect(result.accuracy.coverage.totalCases).toBe(32);
    expect(result.accuracy.coverage.representedRuleIds).toHaveLength(8);
    expect(result.accuracy.aggregate.counts).toEqual({
      tp: 16,
      fn: 0,
      fp: 0,
      tn: 16,
      error: 0,
      unsupported: 0,
      contractMismatch: 0,
    });
    expect(result.performance.environment).toEqual({
      nodeVersion: "22.23.2",
      os: "Ubuntu 24.04.4",
      platform: "linux",
      arch: "x64",
    });
    expect(result.performance.historical).toEqual({
      fixture: "scanner-medium-v1",
      filesAnalyzed: 700,
      findings: 0,
      errors: 0,
      scanDurationMs: 597,
      wallMs: 644,
      rssDeltaBytes: 27738112,
      maxWallMs: 20000,
    });

    const dependency = result.performance.profiles.find((item) => item.id === "dependency-lockfile-heavy-v1")!;
    const iac = result.performance.profiles.find((item) => item.id === "iac-heavy-v1")!;
    const source = result.performance.profiles.find((item) => item.id === "source-ast-heavy-v1")!;
    expect(dependency.runs.map((run) => [run.scanDurationMs, run.wallMs, run.rssDeltaBytes])).toEqual([
      [2426, 2428, 1241088],
      [2391, 2392, 4124672],
      [2350, 2351, 3100672],
    ]);
    expect(iac.runs.map((run) => [run.scanDurationMs, run.wallMs, run.rssDeltaBytes])).toEqual([
      [549, 588, 48025600],
      [387, 426, 524288],
      [368, 400, 409600],
    ]);
    expect(source.runs.map((run) => [run.scanDurationMs, run.wallMs, run.rssDeltaBytes])).toEqual([
      [1234, 1287, 786432],
      [978, 1020, 131072],
      [979, 1034, 131072],
    ]);
    expect(dependency.summary.medianWallMs).toBe(2392);
    expect(iac.summary.medianWallMs).toBe(426);
    expect(source.summary.medianWallMs).toBe(1034);
  });

  it("keeps the committed Markdown byte-identical and canonical JSON deterministic", async () => {
    const evidence = parsePublicationEvidence(await readFile(EVIDENCE, "utf8"));
    const result = normalizePublicationEvidence(evidence);
    const firstJson = serializeTechnicalPublicationJson(result);
    const secondJson = serializeTechnicalPublicationJson(result);
    expect(firstJson).toBe(secondJson);
    expect(JSON.parse(firstJson)).toEqual(result);
    expect(await readFile(MARKDOWN_REPORT, "utf8")).toBe(renderTechnicalPublicationMarkdown(result));
  });
});
