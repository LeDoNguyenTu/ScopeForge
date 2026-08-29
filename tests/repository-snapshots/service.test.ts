import { describe, expect, it, vi } from "vitest";
import {
  publishRepositorySnapshotAttempt,
  requestRepositorySnapshot,
  type RepositorySnapshotRepository,
} from "@/lib/repository-snapshots/service";
import type { RepositorySnapshotObjectStore } from "@/lib/repository-snapshots/object-store";

const ids = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  assetId: "22222222-2222-4222-8222-222222222222",
  actorId: "33333333-3333-4333-8333-333333333333",
  workerId: "44444444-4444-4444-8444-444444444444",
  taskId: "55555555-5555-4555-8555-555555555555",
  attemptId: "66666666-6666-4666-8666-666666666666",
};

function repository(overrides: Partial<RepositorySnapshotRepository> = {}): RepositorySnapshotRepository {
  return {
    enqueue: vi.fn(async () => ({
      scanJobId: "77777777-7777-4777-8777-777777777777",
      taskId: ids.taskId,
      executionClass: "repository_snapshot_github_public_v1" as const,
      absoluteDeadlineAt: "2026-08-27T03:40:00.000Z",
    })),
    getAttemptArtifact: vi.fn(async () => ({
      objectKey: `repository-source/${"a".repeat(64)}.tar.gz`,
      createdAt: "2026-08-27T03:20:00.000Z",
    })),
    publish: vi.fn(async () => ({
      taskId: ids.taskId,
      attemptId: ids.attemptId,
      outcome: "succeeded" as const,
      replayed: false,
      snapshotId: "88888888-8888-4888-8888-888888888888",
    })),
    ...overrides,
  };
}

function objectStore(overrides: Partial<RepositorySnapshotObjectStore> = {}): RepositorySnapshotObjectStore {
  return {
    createAttemptUpload: vi.fn(async () => ({
      method: "PUT" as const,
      url: "https://scopeforge-artifacts.example.r2.cloudflarestorage.com/object?X-Amz-Signature=test",
      expiresAt: "2026-08-27T03:26:00.000Z",
    })),
    createAttemptDownload: vi.fn(),
    headObject: vi.fn(async () => ({ exists: true, size: 1234 })),
    deleteObject: vi.fn(async () => undefined),
    ...overrides,
  };
}

const terminal = {
  schemaVersion: 1 as const,
  taskId: ids.taskId,
  attemptId: ids.attemptId,
  executionClass: "repository_snapshot_github_public_v1" as const,
  outcome: "succeeded" as const,
  failureCode: null,
  metrics: {
    wallTimeMs: 10_000,
    cpuTimeMs: 5_000,
    peakMemoryBytes: 100_000_000,
    inputBytes: 1_000_000,
    outputBytes: 1024,
  },
  result: {
    kind: "repository_snapshot_github_public" as const,
    canonicalRepositoryUrl: "https://github.com/openai/openai-node",
    defaultBranch: "main",
    resolvedCommitSha: "b".repeat(40),
    contentDigest: "c".repeat(64),
    artifactDigest: "d".repeat(64),
    compressedBytes: 900_000,
    expandedBytes: 2_000_000,
    retainedFileCount: 10,
    retainedBytes: 1_500_000,
    storedArtifactBytes: 1234,
    skipCounts: {
      symlink: 0,
      hardlink: 0,
      fileTooLarge: 0,
      retainedFileLimit: 0,
      retainedBytesLimit: 0,
    },
  },
};

describe("Phase 6B trusted repository snapshot services", () => {
  it("requests a snapshot using only trusted workspace/asset/actor identity", async () => {
    const repo = repository();
    const result = await requestRepositorySnapshot({
      workspaceId: ids.workspaceId,
      assetId: ids.assetId,
      actorId: ids.actorId,
    }, { repository: repo });

    expect(result.taskId).toBe(ids.taskId);
    expect(repo.enqueue).toHaveBeenCalledWith({
      workspaceId: ids.workspaceId,
      assetId: ids.assetId,
      actorId: ids.actorId,
    });
    expect(vi.mocked(repo.enqueue).mock.calls[0]?.[0]).not.toHaveProperty("url");
    expect(vi.mocked(repo.enqueue).mock.calls[0]?.[0]).not.toHaveProperty("branch");
    expect(vi.mocked(repo.enqueue).mock.calls[0]?.[0]).not.toHaveProperty("budget");
  });

  it("HEAD-verifies the lease-bound artifact before successful publication", async () => {
    const repo = repository();
    const store = objectStore();

    const result = await publishRepositorySnapshotAttempt({
      workerId: ids.workerId,
      leaseToken: "e".repeat(64),
      terminal,
    }, { repository: repo, objectStore: store });

    expect(store.headObject).toHaveBeenCalledWith(`repository-source/${"a".repeat(64)}.tar.gz`);
    expect(repo.publish).toHaveBeenCalledWith(expect.objectContaining({
      workerId: ids.workerId,
      taskId: ids.taskId,
      attemptId: ids.attemptId,
      serverObservedObjectBytes: 1234,
      storedArtifactBytes: 1234,
      resolvedCommitSha: "b".repeat(40),
    }));
    expect(result.outcome).toBe("succeeded");
  });

  it("fails closed when the object is missing or has the wrong size", async () => {
    const missingRepo = repository();
    await expect(publishRepositorySnapshotAttempt({
      workerId: ids.workerId,
      leaseToken: "e".repeat(64),
      terminal,
    }, {
      repository: missingRepo,
      objectStore: objectStore({ headObject: vi.fn(async () => ({ exists: false, size: null })) }),
    })).rejects.toThrow("REPOSITORY_SNAPSHOT_ARTIFACT_NOT_AVAILABLE");
    expect(missingRepo.publish).not.toHaveBeenCalled();

    const mismatchRepo = repository();
    await expect(publishRepositorySnapshotAttempt({
      workerId: ids.workerId,
      leaseToken: "e".repeat(64),
      terminal,
    }, {
      repository: mismatchRepo,
      objectStore: objectStore({ headObject: vi.fn(async () => ({ exists: true, size: 1235 })) }),
    })).rejects.toThrow("REPOSITORY_SNAPSHOT_ARTIFACT_SIZE_MISMATCH");
    expect(mismatchRepo.publish).not.toHaveBeenCalled();
  });

  it("preserves exact publication replay without exposing object keys", async () => {
    const publish = vi.fn(async () => ({
      taskId: ids.taskId,
      attemptId: ids.attemptId,
      outcome: "succeeded" as const,
      replayed: true,
      snapshotId: "88888888-8888-4888-8888-888888888888",
    }));
    const result = await publishRepositorySnapshotAttempt({
      workerId: ids.workerId,
      leaseToken: "e".repeat(64),
      terminal,
    }, { repository: repository({ publish }), objectStore: objectStore() });

    expect(result.replayed).toBe(true);
    expect(JSON.stringify(result)).not.toContain("repository-source/");
  });
});