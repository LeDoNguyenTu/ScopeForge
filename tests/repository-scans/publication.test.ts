import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  publishRepositoryScanSuccess,
  type RepositoryScanPublicationRepository,
} from "@/lib/repository-scans/service";
import { HOSTED_PHASE3_SCANNER_DESCRIPTORS } from "@/packages/hosted-scanner-runner/profile";

const ids = {
  workerId: "11111111-1111-4111-8111-111111111111",
  taskId: "22222222-2222-4222-8222-222222222222",
  attemptId: "33333333-3333-4333-8333-333333333333",
  snapshotId: "44444444-4444-4444-8444-444444444444",
  assetId: "55555555-5555-4555-8555-555555555555",
};
const repositoryUrl = "https://github.com/openai/openai-node";

function hostedResult() {
  const payload = {
    schemaVersion: 1,
    tool: { name: "ScopeForge", version: "0.1.0" },
    repository: { canonicalUrl: repositoryUrl },
    scan: {
      startedAt: "2026-08-27T01:00:00.000Z",
      durationMs: 1000,
      scanners: [...HOSTED_PHASE3_SCANNER_DESCRIPTORS],
      scannerErrorCount: 0,
    },
    inventory: { filesAnalyzed: 1, filesSkipped: 0, totalBytes: 64 },
    findings: [],
  };
  return {
    ...payload,
    runRef: `sfh1:${createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex")}`,
  };
}

function terminal() {
  const hosted = hostedResult();
  return {
    schemaVersion: 1,
    taskId: ids.taskId,
    attemptId: ids.attemptId,
    executionClass: "phase3_repository_scan_no_egress_v1",
    outcome: "succeeded",
    failureCode: null,
    metrics: { wallTimeMs: 1200, cpuTimeMs: 0, peakMemoryBytes: 0, inputBytes: 64, outputBytes: 512 },
    result: {
      kind: "phase3_repository_scan",
      snapshotId: ids.snapshotId,
      canonicalRepositoryUrl: repositoryUrl,
      resolvedCommitSha: "a".repeat(40),
      contentDigest: "b".repeat(64),
      scannerProfileId: "phase3-hosted-static-v1",
      scannerProfileVersion: 1,
      resultDigest: createHash("sha256").update(JSON.stringify(hosted), "utf8").digest("hex"),
      hostedResult: hosted,
    },
  };
}

function repository(): RepositoryScanPublicationRepository {
  return {
    publishSuccess: vi.fn(async () => ({
      taskId: ids.taskId,
      attemptId: ids.attemptId,
      runId: "66666666-6666-4666-8666-666666666666",
      outcome: "succeeded",
      replayed: false,
    })),
  };
}

function claimedSnapshot() {
  return {
    assetId: ids.assetId,
    snapshotId: ids.snapshotId,
    canonicalRepositoryUrl: repositoryUrl,
    resolvedCommitSha: "a".repeat(40),
    contentDigest: "b".repeat(64),
    artifactDigest: "d".repeat(64),
    scannerProfileId: "phase3-hosted-static-v1" as const,
    scannerProfileVersion: 1 as const,
    retainedFileCount: 1,
    retainedBytes: 64,
  };
}

describe("Phase 6C atomic publication service", () => {
  it("derives persistence rows and sends only validated server-bound publication data to the RPC repository", async () => {
    const repo = repository();
    const result = await publishRepositoryScanSuccess({
      workerId: ids.workerId,
      taskId: ids.taskId,
      attemptId: ids.attemptId,
      leaseToken: "c".repeat(64),
      terminal: terminal(),
      claimedSnapshot: claimedSnapshot(),
    }, { repository: repo });

    expect(repo.publishSuccess).toHaveBeenCalledWith(expect.objectContaining({
      workerId: ids.workerId,
      taskId: ids.taskId,
      attemptId: ids.attemptId,
      leaseToken: "c".repeat(64),
      snapshotId: ids.snapshotId,
      repositoryCanonicalUrl: repositoryUrl,
      runRef: expect.stringMatching(/^sfh1:[a-f0-9]{64}$/),
      resultDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      scannerErrorCount: 0,
      scannerDescriptors: [...HOSTED_PHASE3_SCANNER_DESCRIPTORS],
      findings: [],
      evidence: [],
    }));
    expect(result.outcome).toBe("succeeded");
  });

  it("keeps repository asset identity distinct from snapshot identity for canonical finding normalization", async () => {
    const source = await import("@/lib/repository-scans/service");
    expect(source.publishRepositoryScanSuccess.toString()).toContain("deriveHostedPhase3PersistenceRows(assetId, envelope)");
    expect(ids.assetId).not.toBe(ids.snapshotId);
  });

  it("never invokes persistence when validation fails", async () => {
    const repo = repository();
    const invalid = terminal();
    invalid.result.hostedResult.scan.scannerErrorCount = 1;

    await expect(publishRepositoryScanSuccess({
      workerId: ids.workerId,
      taskId: ids.taskId,
      attemptId: ids.attemptId,
      leaseToken: "c".repeat(64),
      terminal: invalid,
      claimedSnapshot: claimedSnapshot(),
    }, { repository: repo })).rejects.toThrow();
    expect(repo.publishSuccess).not.toHaveBeenCalled();
  });
});
