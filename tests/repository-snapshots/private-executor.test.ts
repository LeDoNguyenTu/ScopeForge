import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { workerExecutionProfile } from "@/packages/worker-contracts";
import {
  createPrivateRepositorySnapshotExecutor,
  type PrivateRepositorySnapshotExecutorDependencies,
} from "@/packages/worker-supervisor/private-repository-snapshot";

const COMMIT = "a".repeat(40);
const contract = {
  taskId: "11111111-1111-4111-8111-111111111111",
  attemptId: "22222222-2222-4222-8222-222222222222",
  executionClass: "repository_snapshot_github_private_v1" as const,
  absoluteDeadlineAt: "2026-09-11T00:10:00.000Z",
  budget: workerExecutionProfile("repository_snapshot_github_private_v1").budget,
  input: {
    kind: "repository_snapshot_github_private" as const,
    owner: "example-org",
    repository: "private-repo",
    canonicalRepositoryUrl: "https://github.com/example-org/private-repo",
    privateArchiveLease: {
      kind: "github_private_archive_lease_v1" as const,
      canonicalRepositoryUrl: "https://github.com/example-org/private-repo",
      defaultBranch: "main",
      resolvedCommitSha: COMMIT,
      archiveUrl: `https://codeload.github.com/example-org/private-repo/legacy.tar.gz/${COMMIT}?token=temporary-capability`,
      expiresAt: "2026-09-11T00:04:00.000Z",
    },
    artifactUpload: {
      method: "PUT" as const,
      url: `https://scopeforge-artifacts.${"a".repeat(32)}.r2.cloudflarestorage.com/repository-source/${"b".repeat(64)}.tar.gz?X-Amz-Signature=attempt-only`,
      expiresAt: "2026-09-11T00:04:00.000Z",
    },
  },
};

function dependencies(
  overrides: Partial<PrivateRepositorySnapshotExecutorDependencies> = {},
): PrivateRepositorySnapshotExecutorDependencies {
  return {
    source: {
      openArchive: vi.fn(async () => ({
        response: Readable.from([Buffer.from("archive")]),
        contentType: "application/x-gzip",
        contentLength: 7,
      })),
    },
    parseArchive: vi.fn(async () => ({
      files: [],
      compressedBytes: 7,
      expandedBytes: 0,
      skipCounts: { symlink: 0, hardlink: 0, fileTooLarge: 0, retainedFileLimit: 0, retainedBytesLimit: 0 },
    })),
    writeBundle: vi.fn(async () => ({
      artifactPath: "/tmp/scopeforge-private/repository-snapshot.tar.gz",
      contentDigest: "d".repeat(64),
      artifactDigest: "e".repeat(64),
      retainedFileCount: 0,
      retainedBytes: 0,
      storedArtifactBytes: 1234,
      skipCounts: { symlink: 0, hardlink: 0, fileTooLarge: 0, retainedFileLimit: 0, retainedBytesLimit: 0 },
    })),
    upload: vi.fn(async () => undefined),
    createWorkDirectory: vi.fn(async () => "/tmp/scopeforge-private"),
    removeWorkDirectory: vi.fn(async () => undefined),
    now: vi.fn(() => 1_000),
    cpuUsage: vi.fn(() => ({ user: 1_000, system: 1_000 })),
    memoryUsage: vi.fn(() => ({ rss: 100_000_000 })),
    ...overrides,
  };
}

describe("Phase 10A2 private repository snapshot executor", () => {
  it("consumes only the brokered source lease and emits bounded private provenance", async () => {
    const deps = dependencies();
    const result = await createPrivateRepositorySnapshotExecutor(deps).execute(
      contract,
      new AbortController().signal,
    );

    expect(deps.source.openArchive).toHaveBeenCalledWith(
      contract.input.privateArchiveLease,
      expect.any(AbortSignal),
    );
    expect(deps.parseArchive).toHaveBeenCalledWith(expect.objectContaining({
      expectedCommitSha: COMMIT,
    }));
    expect(deps.writeBundle).toHaveBeenCalledWith(expect.objectContaining({
      source: {
        canonicalRepositoryUrl: contract.input.canonicalRepositoryUrl,
        defaultBranch: "main",
        resolvedCommitSha: COMMIT,
      },
    }));
    expect(deps.upload).toHaveBeenCalledWith(expect.objectContaining({
      descriptor: contract.input.artifactUpload,
      artifactPath: "/tmp/scopeforge-private/repository-snapshot.tar.gz",
      storedArtifactBytes: 1234,
    }));
    expect(result).toMatchObject({
      executionClass: "repository_snapshot_github_private_v1",
      outcome: "succeeded",
      failureCode: null,
      result: {
        kind: "repository_snapshot_github_private",
        canonicalRepositoryUrl: contract.input.canonicalRepositoryUrl,
        defaultBranch: "main",
        resolvedCommitSha: COMMIT,
        contentDigest: "d".repeat(64),
        artifactDigest: "e".repeat(64),
        storedArtifactBytes: 1234,
      },
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("temporary-capability");
    expect(serialized).not.toContain("X-Amz-Signature");
    expect(serialized).not.toContain("archiveUrl");
    expect(serialized).not.toContain("artifactUpload");
  });

  it("maps codeload redirect/network failures to the closed repository network code", async () => {
    const deps = dependencies({
      source: {
        openArchive: vi.fn(async () => { throw new Error("private archive redirect rejected"); }),
      },
    });
    const result = await createPrivateRepositorySnapshotExecutor(deps).execute(
      contract,
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      outcome: "failed",
      failureCode: "REPOSITORY_NETWORK_POLICY_FAILED",
      result: null,
    });
  });

  it("returns cancellation without touching the private source when already aborted", async () => {
    const deps = dependencies();
    const controller = new AbortController();
    controller.abort();
    const result = await createPrivateRepositorySnapshotExecutor(deps).execute(contract, controller.signal);
    expect(result).toMatchObject({ outcome: "cancelled", failureCode: null, result: null });
    expect(deps.source.openArchive).not.toHaveBeenCalled();
  });
});
