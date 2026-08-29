import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateRepositoryScanSuccess } from "@/lib/repository-scans/result-validation";
import { HOSTED_PHASE3_SCANNER_DESCRIPTORS } from "@/packages/hosted-scanner-runner/contract";

const TASK_ID = "11111111-1111-4111-8111-111111111111";
const ATTEMPT_ID = "22222222-2222-4222-8222-222222222222";
const SNAPSHOT_ID = "33333333-3333-4333-8333-333333333333";
const REPOSITORY_URL = "https://github.com/openai/openai-node";

function hostedResult(overrides: Record<string, unknown> = {}) {
  const payload = {
    schemaVersion: 1,
    tool: { name: "ScopeForge", version: "0.1.0" },
    repository: { canonicalUrl: REPOSITORY_URL },
    scan: {
      startedAt: "2026-08-27T01:00:00.000Z",
      durationMs: 1000,
      scanners: [...HOSTED_PHASE3_SCANNER_DESCRIPTORS],
      scannerErrorCount: 0,
    },
    inventory: { filesAnalyzed: 2, filesSkipped: 1, totalBytes: 128 },
    findings: [],
    ...overrides,
  };
  const runRef = `sfh1:${createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex")}`;
  return { ...payload, runRef };
}

function terminal(result = hostedResult()) {
  const resultDigest = createHash("sha256").update(JSON.stringify(result), "utf8").digest("hex");
  return {
    schemaVersion: 1,
    taskId: TASK_ID,
    attemptId: ATTEMPT_ID,
    executionClass: "phase3_repository_scan_no_egress_v1",
    outcome: "succeeded",
    failureCode: null,
    metrics: {
      wallTimeMs: 1500,
      cpuTimeMs: 0,
      peakMemoryBytes: 0,
      inputBytes: 128,
      outputBytes: Buffer.byteLength(JSON.stringify(result), "utf8"),
    },
    result: {
      kind: "phase3_repository_scan",
      snapshotId: SNAPSHOT_ID,
      canonicalRepositoryUrl: REPOSITORY_URL,
      resolvedCommitSha: "a".repeat(40),
      contentDigest: "b".repeat(64),
      artifactDigest: "c".repeat(64),
      scannerProfileId: "phase3-hosted-static-v1",
      scannerProfileVersion: 1,
      resultDigest,
      hostedResult: result,
    },
  };
}

const expected = {
  taskId: TASK_ID,
  attemptId: ATTEMPT_ID,
  snapshotId: SNAPSHOT_ID,
  canonicalRepositoryUrl: REPOSITORY_URL,
  resolvedCommitSha: "a".repeat(40),
  contentDigest: "b".repeat(64),
  artifactDigest: "c".repeat(64),
  scannerProfileId: "phase3-hosted-static-v1" as const,
  scannerProfileVersion: 1 as const,
  retainedFileCount: 3,
  retainedBytes: 128,
};

describe("Phase 6C repository scan result validation", () => {
  it("accepts an exact successful worker result and returns the strictly validated hosted envelope", () => {
    const result = validateRepositoryScanSuccess(terminal(), expected);
    expect(result.terminal.taskId).toBe(TASK_ID);
    expect(result.terminal.result?.kind === "phase3_repository_scan" ? result.terminal.result.artifactDigest : null)
      .toBe(expected.artifactDigest);
    expect(result.envelope.repository.canonicalUrl).toBe(REPOSITORY_URL);
    expect(result.envelope.scan.scanners).toEqual([...HOSTED_PHASE3_SCANNER_DESCRIPTORS]);
    expect(result.envelope.scan.scannerErrorCount).toBe(0);
  });

  it("rejects terminal identity, snapshot/profile provenance, scanner errors, descriptor drift, inventory overflow, and result-digest drift", () => {
    const cases: Array<[unknown, typeof expected]> = [
      [{ ...terminal(), attemptId: "44444444-4444-4444-8444-444444444444" }, expected],
      [terminal(), { ...expected, snapshotId: "44444444-4444-4444-8444-444444444444" }],
      [terminal(), { ...expected, resolvedCommitSha: "d".repeat(40) }],
      [terminal(), { ...expected, contentDigest: "e".repeat(64) }],
      [terminal(), { ...expected, artifactDigest: "f".repeat(64) }],
      [terminal(hostedResult({ scan: { ...hostedResult().scan, scannerErrorCount: 1 } })), expected],
      [terminal(hostedResult({ scan: { ...hostedResult().scan, scanners: ["secrets@1.0.0"] } })), expected],
      [terminal(hostedResult({ inventory: { filesAnalyzed: 4, filesSkipped: 0, totalBytes: 128 } })), expected],
      [terminal(hostedResult({ inventory: { filesAnalyzed: 2, filesSkipped: 0, totalBytes: 129 } })), expected],
      [{ ...terminal(), result: { ...terminal().result, resultDigest: "0".repeat(64) } }, expected],
    ];
    for (const [value, expectation] of cases) {
      expect(() => validateRepositoryScanSuccess(value, expectation)).toThrow();
    }
  });
});
