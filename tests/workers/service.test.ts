import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { RepositorySnapshotObjectStore } from "@/lib/repository-snapshots/object-store";
import {
  claimWorkerTask,
  claimWorkerTaskForNode,
  finalizeWorkerAttempt,
  registerWorkerNode,
  type WorkerControlRepository,
} from "@/lib/worker-control/service";
import { workerExecutionProfile } from "@/packages/worker-contracts";

function repository(overrides: Partial<WorkerControlRepository> = {}): WorkerControlRepository {
  return {
    register: vi.fn(async () => ({
      workerId: "11111111-1111-4111-8111-111111111111",
      executionClass: "foundation_no_egress_v1",
      softwareVersion: "0.1.0",
    })),
    registerRepositorySnapshot: vi.fn(async () => ({
      workerId: "11111111-1111-4111-8111-111111111111",
      executionClass: "repository_snapshot_github_public_v1",
      softwareVersion: "0.1.0",
    })),
    registerRepositoryScan: vi.fn(async () => ({
      workerId: "11111111-1111-4111-8111-111111111111",
      executionClass: "phase3_repository_scan_no_egress_v1",
      softwareVersion: "0.1.0",
    })),
    disable: vi.fn(async () => ({ workerId: "11111111-1111-4111-8111-111111111111", disabledAt: "2026-08-26T00:00:00.000Z" })),
    authenticate: vi.fn(async () => ({
      workerId: "11111111-1111-4111-8111-111111111111",
      executionClass: "foundation_no_egress_v1",
      softwareVersion: "0.1.0",
    })),
    enqueueFoundationProbe: vi.fn(async () => ({
      scanJobId: "22222222-2222-4222-8222-222222222222",
      taskId: "33333333-3333-4333-8333-333333333333",
      executionClass: "foundation_no_egress_v1",
      absoluteDeadlineAt: "2026-08-26T00:05:00.000Z",
    })),
    claim: vi.fn(async () => null),
    claimRepositoryScan: vi.fn(async () => null),
    heartbeat: vi.fn(async () => ({ cancelRequested: false, leaseExpiresAt: "2026-08-26T00:01:30.000Z" })),
    finalize: vi.fn(async () => ({
      taskId: "33333333-3333-4333-8333-333333333333",
      attemptId: "44444444-4444-4444-8444-444444444444",
      outcome: "succeeded",
      replayed: false,
    })),
    finalizeRepositoryScanFailure: vi.fn(async () => ({
      taskId: "33333333-3333-4333-8333-333333333333",
      attemptId: "44444444-4444-4444-8444-444444444444",
      outcome: "failed",
      replayed: false,
    })),
    recover: vi.fn(async () => 0),
    fleetSnapshot: vi.fn(async () => ({
      generatedAt: "2026-08-26T00:00:00.000Z",
      nodes: [],
      taskCounts: { queued: 0, leased: 0, retryWait: 0, completed: 0, deadLetter: 0, cancelled: 0 },
      activeLeaseCount: 0,
    })),
    ...overrides,
  };
}

describe("worker control service", () => {
  it("generates the worker secret once and persists only its digest", async () => {
    const repo = repository();
    const rawSecret = Buffer.alloc(32, 7);
    const result = await registerWorkerNode({ softwareVersion: "0.1.0" }, {
      repository: repo,
      randomBytes: () => rawSecret,
    });

    const expectedSecret = rawSecret.toString("hex");
    expect(result.secret).toBe(expectedSecret);
    expect(repo.register).toHaveBeenCalledWith({
      credentialHash: createHash("sha256").update(expectedSecret, "utf8").digest("hex"),
      softwareVersion: "0.1.0",
    });
    expect(JSON.stringify(vi.mocked(repo.register).mock.calls)).not.toContain(expectedSecret);
  });

  it("derives claim authority entirely from authenticated worker identity", async () => {
    const claim = vi.fn(async () => null);
    const repo = repository({ claim });
    await claimWorkerTask({ workerId: "11111111-1111-4111-8111-111111111111" }, { repository: repo });
    expect(claim).toHaveBeenCalledWith({ workerId: "11111111-1111-4111-8111-111111111111" });
  });

  it("routes authenticated Phase 6C nodes to the isolated claim without adding storage authority", async () => {
    const claimRepositoryScan = vi.fn(async () => ({
      taskId: "33333333-3333-4333-8333-333333333333",
      attemptId: "44444444-4444-4444-8444-444444444444",
      executionClass: "phase3_repository_scan_no_egress_v1" as const,
      leaseToken: "b".repeat(64),
      absoluteDeadlineAt: "2026-08-27T03:40:00.000Z",
      budget: workerExecutionProfile("phase3_repository_scan_no_egress_v1").budget,
      input: {
        kind: "phase3_repository_scan" as const,
        snapshotId: "55555555-5555-4555-8555-555555555555",
        canonicalRepositoryUrl: "https://github.com/openai/openai-node",
        resolvedCommitSha: "a".repeat(40),
        contentDigest: "c".repeat(64),
        artifactDigest: "d".repeat(64),
        storedArtifactBytes: 1024,
        retainedFileCount: 2,
        retainedBytes: 900,
        scannerProfileId: "phase3-hosted-static-v1" as const,
        scannerProfileVersion: 1 as const,
      },
    }));
    const repo = repository({ claimRepositoryScan });
    const result = await claimWorkerTaskForNode({
      workerId: "11111111-1111-4111-8111-111111111111",
      executionClass: "phase3_repository_scan_no_egress_v1",
      softwareVersion: "0.1.0",
    }, { repository: repo });

    expect(claimRepositoryScan).toHaveBeenCalledWith({
      workerId: "11111111-1111-4111-8111-111111111111",
    });
    expect(JSON.stringify(result)).not.toContain("repository-source/");
    expect(JSON.stringify(result)).not.toContain("artifactUpload");
  });

  it("replaces the private repository object key with one bounded presigned PUT descriptor", async () => {
    const artifactObjectKey = `repository-source/${"a".repeat(64)}.tar.gz`;
    const claim = vi.fn(async () => ({
      taskId: "33333333-3333-4333-8333-333333333333",
      attemptId: "44444444-4444-4444-8444-444444444444",
      executionClass: "repository_snapshot_github_public_v1" as const,
      leaseToken: "b".repeat(64),
      absoluteDeadlineAt: "2026-08-27T03:40:00.000Z",
      budget: workerExecutionProfile("repository_snapshot_github_public_v1").budget,
      artifactObjectKey,
      input: {
        kind: "repository_snapshot_github_public" as const,
        owner: "openai",
        repository: "openai-node",
        canonicalRepositoryUrl: "https://github.com/openai/openai-node",
      },
    }));
    const createAttemptUpload = vi.fn(async () => ({
      method: "PUT" as const,
      url: "https://scopeforge-artifacts.example.r2.cloudflarestorage.com/object?X-Amz-Signature=test",
      expiresAt: "2026-08-27T03:26:00.000Z",
    }));
    const store: RepositorySnapshotObjectStore = {
      createAttemptUpload,
      createAttemptDownload: vi.fn(),
      headObject: vi.fn(),
      deleteObject: vi.fn(),
    };

    const result = await claimWorkerTask({
      workerId: "11111111-1111-4111-8111-111111111111",
    }, {
      repository: repository({ claim }),
      repositorySnapshotObjectStore: () => store,
      now: () => new Date("2026-08-27T03:20:00.000Z"),
    });

    expect(createAttemptUpload).toHaveBeenCalledWith({
      objectKey: artifactObjectKey,
      expiresAt: new Date("2026-08-27T03:26:00.000Z"),
    });
    expect(result?.input).toMatchObject({
      kind: "repository_snapshot_github_public",
      artifactUpload: { method: "PUT" },
    });
    expect(JSON.stringify(result)).not.toContain(artifactObjectKey);
  });

  it("validates and hashes foundation terminal content before repository finalization", async () => {
    const finalize = vi.fn(async (input) => ({
      taskId: input.taskId,
      attemptId: input.attemptId,
      outcome: input.terminalOutcome,
      replayed: false,
    }));
    const repo = repository({ finalize });
    const terminal = {
      schemaVersion: 1,
      taskId: "33333333-3333-4333-8333-333333333333",
      attemptId: "44444444-4444-4444-8444-444444444444",
      executionClass: "foundation_no_egress_v1",
      outcome: "succeeded",
      failureCode: null,
      metrics: {
        wallTimeMs: 10,
        cpuTimeMs: 5,
        peakMemoryBytes: 1024,
        inputBytes: 8,
        outputBytes: 64,
      },
      result: { kind: "foundation_probe", nonceDigest: "a".repeat(64) },
    };

    await finalizeWorkerAttempt({
      workerId: "11111111-1111-4111-8111-111111111111",
      leaseToken: "b".repeat(64),
      terminal,
    }, { repository: repo });

    const persisted = finalize.mock.calls[0]?.[0];
    expect(persisted?.terminalPayloadDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(persisted).toMatchObject({
      workerId: "11111111-1111-4111-8111-111111111111",
      taskId: terminal.taskId,
      attemptId: terminal.attemptId,
      leaseToken: "b".repeat(64),
      terminalOutcome: "succeeded",
      failureCode: null,
      wallTimeMs: 10,
      cpuTimeMs: 5,
      peakMemoryBytes: 1024,
      inputBytes: 8,
      outputBytes: 64,
    });
    expect(persisted).not.toHaveProperty("command");
    expect(persisted).not.toHaveProperty("networkPolicy");
  });

  it("forces successful repository snapshots through the dedicated publication service", async () => {
    const repo = repository();
    await expect(finalizeWorkerAttempt({
      workerId: "11111111-1111-4111-8111-111111111111",
      leaseToken: "b".repeat(64),
      terminal: {
        schemaVersion: 1,
        taskId: "33333333-3333-4333-8333-333333333333",
        attemptId: "44444444-4444-4444-8444-444444444444",
        executionClass: "repository_snapshot_github_public_v1",
        outcome: "succeeded",
        failureCode: null,
        metrics: { wallTimeMs: 1, cpuTimeMs: 1, peakMemoryBytes: 1, inputBytes: 0, outputBytes: 0 },
        result: {
          kind: "repository_snapshot_github_public",
          canonicalRepositoryUrl: "https://github.com/openai/openai-node",
          defaultBranch: "main",
          resolvedCommitSha: "a".repeat(40),
          contentDigest: "b".repeat(64),
          artifactDigest: "c".repeat(64),
          compressedBytes: 0,
          expandedBytes: 0,
          retainedFileCount: 0,
          retainedBytes: 0,
          storedArtifactBytes: 1,
          skipCounts: { symlink: 0, hardlink: 0, fileTooLarge: 0, retainedFileLimit: 0, retainedBytesLimit: 0 },
        },
      },
    }, { repository: repo })).rejects.toMatchObject({ code: "REPOSITORY_SNAPSHOT_PUBLICATION_REQUIRED" });
    expect(repo.finalize).not.toHaveBeenCalled();
  });

  it("forces successful Phase 6C scans through dedicated atomic publication", async () => {
    const repo = repository();
    await expect(finalizeWorkerAttempt({
      workerId: "11111111-1111-4111-8111-111111111111",
      leaseToken: "b".repeat(64),
      terminal: {
        schemaVersion: 1,
        taskId: "33333333-3333-4333-8333-333333333333",
        attemptId: "44444444-4444-4444-8444-444444444444",
        executionClass: "phase3_repository_scan_no_egress_v1",
        outcome: "succeeded",
        failureCode: null,
        metrics: { wallTimeMs: 1, cpuTimeMs: 0, peakMemoryBytes: 0, inputBytes: 1, outputBytes: 1 },
        result: {
          kind: "phase3_repository_scan",
          snapshotId: "55555555-5555-4555-8555-555555555555",
          canonicalRepositoryUrl: "https://github.com/openai/openai-node",
          resolvedCommitSha: "a".repeat(40),
          contentDigest: "b".repeat(64),
          scannerProfileId: "phase3-hosted-static-v1",
          scannerProfileVersion: 1,
          resultDigest: "c".repeat(64),
          hostedResult: { schemaVersion: 1 },
        },
      },
    }, { repository: repo })).rejects.toMatchObject({ code: "REPOSITORY_SCAN_PUBLICATION_REQUIRED" });
    expect(repo.finalize).not.toHaveBeenCalled();
    expect(repo.finalizeRepositoryScanFailure).not.toHaveBeenCalled();
  });

  it("rejects unexpected terminal fields before persistence", async () => {
    const repo = repository();
    await expect(finalizeWorkerAttempt({
      workerId: "11111111-1111-4111-8111-111111111111",
      leaseToken: "b".repeat(64),
      terminal: {
        schemaVersion: 1,
        taskId: "33333333-3333-4333-8333-333333333333",
        attemptId: "44444444-4444-4444-8444-444444444444",
        executionClass: "foundation_no_egress_v1",
        outcome: "succeeded",
        failureCode: null,
        metrics: { wallTimeMs: 1, cpuTimeMs: 1, peakMemoryBytes: 1, inputBytes: 0, outputBytes: 0 },
        result: { kind: "foundation_probe", nonceDigest: "a".repeat(64) },
        url: "https://example.com",
      },
    }, { repository: repo })).rejects.toThrow(/unexpected/i);
    expect(repo.finalize).not.toHaveBeenCalled();
  });
});