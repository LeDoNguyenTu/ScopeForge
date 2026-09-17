import { describe, expect, it, vi } from "vitest";
import {
  publishPrivateRepositorySnapshotAttempt,
  requestPrivateRepositorySnapshot,
} from "@/lib/repository-snapshots/service";
import type { RepositorySnapshotObjectStore } from "@/lib/repository-snapshots/object-store";

const ids = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  assetId: "22222222-2222-4222-8222-222222222222",
  actorId: "33333333-3333-4333-8333-333333333333",
  linkId: "44444444-4444-4444-8444-444444444444",
  workerId: "55555555-5555-4555-8555-555555555555",
  taskId: "66666666-6666-4666-8666-666666666666",
  attemptId: "77777777-7777-4777-8777-777777777777",
};

function objectStore(): RepositorySnapshotObjectStore {
  return {
    createAttemptUpload: vi.fn(),
    createAttemptDownload: vi.fn(),
    headObject: vi.fn(async () => ({ exists: true, size: 1234 })),
    deleteObject: vi.fn(async () => undefined),
  };
}

const privateTerminal = {
  schemaVersion: 1 as const,
  taskId: ids.taskId,
  attemptId: ids.attemptId,
  executionClass: "repository_snapshot_github_private_v1" as const,
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
    kind: "repository_snapshot_github_private" as const,
    canonicalRepositoryUrl: "https://github.com/octocat/private-repo",
    defaultBranch: "main",
    resolvedCommitSha: "a".repeat(40),
    contentDigest: "b".repeat(64),
    artifactDigest: "c".repeat(64),
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

describe("Phase 10A2 private repository snapshot trusted service", () => {
  it("queues private acquisition using only stable workspace/asset/actor/link identity", async () => {
    const enqueuePrivate = vi.fn(async () => ({
      scanJobId: "88888888-8888-4888-8888-888888888888",
      taskId: ids.taskId,
      executionClass: "repository_snapshot_github_private_v1" as const,
      absoluteDeadlineAt: "2026-09-11T00:20:00.000Z",
    }));
    const repository = { enqueuePrivate } as never;

    await expect(requestPrivateRepositorySnapshot({
      workspaceId: ids.workspaceId,
      assetId: ids.assetId,
      actorId: ids.actorId,
      githubRepositoryLinkId: ids.linkId,
    }, { repository })).resolves.toMatchObject({ executionClass: "repository_snapshot_github_private_v1" });

    expect(enqueuePrivate).toHaveBeenCalledWith({
      workspaceId: ids.workspaceId,
      assetId: ids.assetId,
      actorId: ids.actorId,
      githubRepositoryLinkId: ids.linkId,
    });
  });

  it("HEAD-verifies the same attempt artifact before private immutable publication", async () => {
    const getAttemptArtifact = vi.fn(async () => ({
      objectKey: `repository-source/${"d".repeat(64)}.tar.gz`,
      createdAt: "2026-09-11T00:00:00.000Z",
    }));
    const publish = vi.fn(async () => ({
      taskId: ids.taskId,
      attemptId: ids.attemptId,
      snapshotId: "99999999-9999-4999-8999-999999999999",
      outcome: "succeeded" as const,
      replayed: false,
    }));
    const store = objectStore();
    const repository = { getAttemptArtifact, publish } as never;

    const result = await publishPrivateRepositorySnapshotAttempt({
      workerId: ids.workerId,
      leaseToken: "e".repeat(64),
      terminal: privateTerminal,
    }, { repository, objectStore: store });

    expect(store.headObject).toHaveBeenCalledWith(`repository-source/${"d".repeat(64)}.tar.gz`);
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({
      workerId: ids.workerId,
      taskId: ids.taskId,
      resolvedCommitSha: "a".repeat(40),
      storedArtifactBytes: 1234,
      serverObservedObjectBytes: 1234,
    }));
    expect(result).toMatchObject({ outcome: "succeeded", replayed: false });
    expect(JSON.stringify(result)).not.toMatch(/archiveUrl|installationToken|accessToken|authorization/i);
  });
});
