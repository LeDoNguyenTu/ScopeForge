import { describe, expect, it } from "vitest";
import {
  validateWorkerTerminalEnvelope,
  workerExecutionProfile,
} from "@/packages/worker-contracts";

const EXPECTED = {
  taskId: "11111111-1111-4111-8111-111111111111",
  attemptId: "22222222-2222-4222-8222-222222222222",
  executionClass: "phase3_repository_scan_no_egress_v1" as const,
};

function validMetrics() {
  return {
    wallTimeMs: 120_000,
    cpuTimeMs: 100_000,
    peakMemoryBytes: 512 * 1024 * 1024,
    inputBytes: 128 * 1024 * 1024,
    outputBytes: 100_000,
  };
}

function validHostedResult() {
  return {
    schemaVersion: 1,
    tool: { name: "ScopeForge", version: "0.1.0" },
    repository: { canonicalUrl: "https://github.com/openai/openai-node" },
    runRef: `sfh1:${"a".repeat(64)}`,
    scan: {
      startedAt: "2026-08-27T00:00:00.000Z",
      durationMs: 10_000,
      scanners: ["iac@1.0.0", "jsts@1.0.0", "sca@1.0.0", "secrets@1.0.0"],
      scannerErrorCount: 0,
    },
    inventory: { filesAnalyzed: 10, filesSkipped: 2, totalBytes: 1024 },
    findings: [],
  };
}

function validResult() {
  return {
    kind: "phase3_repository_scan" as const,
    snapshotId: "33333333-3333-4333-8333-333333333333",
    canonicalRepositoryUrl: "https://github.com/openai/openai-node",
    resolvedCommitSha: "b".repeat(40),
    contentDigest: "c".repeat(64),
    scannerProfileId: "phase3-hosted-static-v1" as const,
    scannerProfileVersion: 1 as const,
    resultDigest: "d".repeat(64),
    hostedResult: validHostedResult(),
  };
}

describe("Phase 6C repository scan worker contracts", () => {
  it("pins a zero-egress fixed execution profile", () => {
    expect(workerExecutionProfile("phase3_repository_scan_no_egress_v1")).toEqual({
      executionClass: "phase3_repository_scan_no_egress_v1",
      networkPolicy: "none",
      budget: {
        maxWallTimeMs: 300_000,
        maxCpuTimeMs: 300_000,
        maxMemoryBytes: 1_073_741_824,
        maxProcesses: 64,
        maxInputFiles: 20_000,
        maxInputBytes: 268_435_456,
        maxScratchBytes: 268_435_456,
        maxOutputBytes: 3_670_016,
      },
    });
  });

  it("validates exactly-bound privacy-reduced scan success", () => {
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

  it("rejects storage, command, network, image, source, and environment authority in results", () => {
    for (const extra of [
      { objectKey: "repository-source/private.tar.gz" },
      { artifactUrl: "https://example.invalid/?X-Amz-Signature=secret" },
      { command: ["npm", "install"] },
      { image: "attacker/image:latest" },
      { networkPolicy: "host" },
      { env: { TOKEN: "secret" } },
      { sourceFiles: [{ path: "src/index.ts", text: "secret source" }] },
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

  it("allows only the closed Phase 6C failure set", () => {
    for (const failureCode of [
      "REPOSITORY_SCAN_ARTIFACT_UNAVAILABLE",
      "REPOSITORY_SCAN_ARTIFACT_INTEGRITY_FAILED",
      "REPOSITORY_SCAN_SNAPSHOT_INVALID",
      "REPOSITORY_SCAN_SANDBOX_FAILED",
      "REPOSITORY_SCAN_SCANNER_FAILED",
      "REPOSITORY_SCAN_OUTPUT_INVALID",
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
      failureCode: "REPOSITORY_SCAN_RUN_NPM_INSTALL",
      metrics: validMetrics(),
      result: null,
    }, EXPECTED)).toThrow(/failure code/i);
  });

  it("rejects malformed scan provenance", () => {
    for (const result of [
      { ...validResult(), snapshotId: "not-a-uuid" },
      { ...validResult(), resolvedCommitSha: "z".repeat(40) },
      { ...validResult(), contentDigest: "C".repeat(64) },
      { ...validResult(), resultDigest: "g".repeat(64) },
      { ...validResult(), scannerProfileId: "caller-selected-profile" },
      { ...validResult(), scannerProfileVersion: 2 },
      { ...validResult(), hostedResult: [] },
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
});