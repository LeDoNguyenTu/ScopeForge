import { describe, expect, it } from "vitest";
import {
  validateWorkerTerminalEnvelope,
  workerExecutionProfile,
} from "@/packages/worker-contracts";

const EXPECTED = {
  taskId: "11111111-1111-4111-8111-111111111111",
  attemptId: "22222222-2222-4222-8222-222222222222",
  executionClass: "repository_snapshot_github_public_v1" as const,
};

function validMetrics() {
  return {
    wallTimeMs: 20_000,
    cpuTimeMs: 10_000,
    peakMemoryBytes: 64 * 1024 * 1024,
    inputBytes: 128 * 1024 * 1024,
    outputBytes: 2_048,
  };
}

function validResult() {
  return {
    kind: "repository_snapshot_github_public" as const,
    canonicalRepositoryUrl: "https://github.com/openai/openai-node",
    defaultBranch: "main",
    resolvedCommitSha: "a".repeat(40),
    contentDigest: "b".repeat(64),
    artifactDigest: "c".repeat(64),
    compressedBytes: 12_345,
    expandedBytes: 45_000,
    retainedFileCount: 42,
    retainedBytes: 34_567,
    storedArtifactBytes: 45_678,
    skipCounts: {
      symlink: 1,
      hardlink: 2,
      fileTooLarge: 3,
      retainedFileLimit: 4,
      retainedBytesLimit: 5,
    },
  };
}

describe("Phase 6B repository snapshot worker contracts", () => {
  it("pins the repository snapshot execution class and network policy", () => {
    expect(workerExecutionProfile("repository_snapshot_github_public_v1")).toEqual({
      executionClass: "repository_snapshot_github_public_v1",
      networkPolicy: "github_public_archive_and_attempt_artifact_put_v1",
      budget: {
        maxWallTimeMs: 300_000,
        maxCpuTimeMs: 120_000,
        maxMemoryBytes: 536_870_912,
        maxProcesses: 1,
        maxInputFiles: 20_000,
        maxInputBytes: 268_435_456,
        maxScratchBytes: 536_870_912,
        maxOutputBytes: 65_536,
      },
    });
  });

  it("validates exactly-bound successful repository snapshot provenance", () => {
    expect(validateWorkerTerminalEnvelope({
      schemaVersion: 1,
      taskId: EXPECTED.taskId,
      attemptId: EXPECTED.attemptId,
      executionClass: EXPECTED.executionClass,
      outcome: "succeeded",
      failureCode: null,
      metrics: validMetrics(),
      result: validResult(),
    }, EXPECTED)).toMatchObject({
      outcome: "succeeded",
      failureCode: null,
      result: validResult(),
    });
  });

  it("rejects repository snapshot result fields that could leak storage authority or source", () => {
    for (const extra of [
      { objectKey: "repository-source/private.tar.gz" },
      { uploadUrl: "https://example.invalid/?X-Amz-Signature=secret" },
      { files: [{ path: "src/index.ts", text: "secret source" }] },
      { headers: { authorization: "Bearer secret" } },
    ]) {
      expect(() => validateWorkerTerminalEnvelope({
        schemaVersion: 1,
        taskId: EXPECTED.taskId,
        attemptId: EXPECTED.attemptId,
        executionClass: EXPECTED.executionClass,
        outcome: "succeeded",
        failureCode: null,
        metrics: validMetrics(),
        result: { ...validResult(), ...extra },
      }, EXPECTED)).toThrow(/unexpected|invalid|supported/i);
    }
  });

  it("rejects malformed commit/digest/branch/count provenance", () => {
    for (const result of [
      { ...validResult(), resolvedCommitSha: "g".repeat(40) },
      { ...validResult(), contentDigest: "A".repeat(64) },
      { ...validResult(), artifactDigest: "z".repeat(64) },
      { ...validResult(), defaultBranch: "x".repeat(256) },
      { ...validResult(), retainedFileCount: 20_001 },
      { ...validResult(), retainedBytes: 268_435_457 },
      { ...validResult(), storedArtifactBytes: 335_544_321 },
      { ...validResult(), skipCounts: { ...validResult().skipCounts, other: 1 } },
    ]) {
      expect(() => validateWorkerTerminalEnvelope({
        schemaVersion: 1,
        taskId: EXPECTED.taskId,
        attemptId: EXPECTED.attemptId,
        executionClass: EXPECTED.executionClass,
        outcome: "succeeded",
        failureCode: null,
        metrics: validMetrics(),
        result,
      }, EXPECTED)).toThrow();
    }
  });

  it("allows only closed repository acquisition failure provenance", () => {
    for (const failureCode of [
      "REPOSITORY_UNAVAILABLE",
      "REPOSITORY_IDENTITY_CHANGED",
      "REPOSITORY_NETWORK_POLICY_FAILED",
      "REPOSITORY_ARCHIVE_UNSAFE",
      "REPOSITORY_ARCHIVE_BUDGET_EXCEEDED",
      "REPOSITORY_ARTIFACT_UPLOAD_FAILED",
    ]) {
      expect(validateWorkerTerminalEnvelope({
        schemaVersion: 1,
        taskId: EXPECTED.taskId,
        attemptId: EXPECTED.attemptId,
        executionClass: EXPECTED.executionClass,
        outcome: "failed",
        failureCode,
        metrics: validMetrics(),
        result: null,
      }, EXPECTED).failureCode).toBe(failureCode);
    }

    expect(() => validateWorkerTerminalEnvelope({
      schemaVersion: 1,
      taskId: EXPECTED.taskId,
      attemptId: EXPECTED.attemptId,
      executionClass: EXPECTED.executionClass,
      outcome: "failed",
      failureCode: "REPOSITORY_RUN_GIT",
      metrics: validMetrics(),
      result: null,
    }, EXPECTED)).toThrow(/failure code/i);
  });
});