import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  publishRepositoryScanSuccess,
  type RepositoryScanPublicationRepository,
} from "@/lib/repository-scans/service";
import { HOSTED_PHASE3_SCANNER_DESCRIPTORS } from "@/packages/hosted-scanner-runner/contract";
import { createHostedFindingIdentity } from "@/packages/scanner-output/hosted/identity";
import type { HostedPhase3EnvelopeV1 } from "@/packages/scanner-output/hosted/types";

const ids = {
  workerId: "11111111-1111-4111-8111-111111111111",
  taskId: "22222222-2222-4222-8222-222222222222",
  attemptId: "33333333-3333-4333-8333-333333333333",
  snapshotId: "44444444-4444-4444-8444-444444444444",
  assetId: "55555555-5555-4555-8555-555555555555",
};
const repositoryUrl = "https://github.com/openai/openai-node";

const canonicalFinding: HostedPhase3EnvelopeV1["findings"][number] = {
  fingerprint: `sf1:${"e".repeat(64)}`,
  scanner: "sca",
  ruleId: "sca/known-vulnerability",
  ruleVersion: "1.0.0",
  title: "Known vulnerable dependency",
  description: "A dependency version matches a reviewed vulnerability source.",
  severity: "high",
  confidence: "high",
  validation: "static_confirmed",
  location: { path: "package-lock.json", line: 1, startColumn: 1, endColumn: 2 },
  evidence: { summary: "Dependency evidence." },
  taxonomy: { cwe: ["CWE-1104"], owasp: [], references: [] },
  remediation: {
    summary: "Upgrade the dependency.",
    guidance: "Upgrade to a fixed release.",
    verification: "Run the scanner again.",
  },
};

function hostedResult(findings: HostedPhase3EnvelopeV1["findings"] = []) {
  const payload = {
    schemaVersion: 1 as const,
    tool: { name: "ScopeForge" as const, version: "0.1.0" },
    repository: { canonicalUrl: repositoryUrl },
    scan: {
      startedAt: "2026-08-27T01:00:00.000Z",
      durationMs: 1000,
      scanners: [...HOSTED_PHASE3_SCANNER_DESCRIPTORS],
      scannerErrorCount: 0,
    },
    inventory: { filesAnalyzed: 1, filesSkipped: 0, totalBytes: 64 },
    findings,
  };
  return {
    ...payload,
    runRef: `sfh1:${createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex")}`,
  };
}

function terminal(findings: HostedPhase3EnvelopeV1["findings"] = []) {
  const hosted = hostedResult(findings);
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
      artifactDigest: "d".repeat(64),
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
      outcome: "succeeded" as const,
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
    const repo = repository();
    await publishRepositoryScanSuccess({
      workerId: ids.workerId,
      taskId: ids.taskId,
      attemptId: ids.attemptId,
      leaseToken: "c".repeat(64),
      terminal: terminal([canonicalFinding]),
      claimedSnapshot: claimedSnapshot(),
    }, { repository: repo });

    const expectedAssetIdentity = createHostedFindingIdentity({
      repositoryAssetId: ids.assetId,
      fingerprint: canonicalFinding.fingerprint,
      scanner: canonicalFinding.scanner,
      ruleId: canonicalFinding.ruleId,
      ruleVersion: canonicalFinding.ruleVersion,
    });
    const snapshotBoundIdentity = createHostedFindingIdentity({
      repositoryAssetId: ids.snapshotId,
      fingerprint: canonicalFinding.fingerprint,
      scanner: canonicalFinding.scanner,
      ruleId: canonicalFinding.ruleId,
      ruleVersion: canonicalFinding.ruleVersion,
    });

    const publish = vi.mocked(repo.publishSuccess);
    const persisted = publish.mock.calls[0]?.[0];
    expect(expectedAssetIdentity).not.toBe(snapshotBoundIdentity);
    expect(persisted?.findings[0]?.finding_id).toBe(expectedAssetIdentity);
    expect(persisted?.findings[0]?.finding_id).not.toBe(snapshotBoundIdentity);
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
