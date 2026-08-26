import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  createRepositorySnapshotExecutor,
  type RepositorySnapshotExecutorDependencies,
} from "@/packages/worker-supervisor/repository-snapshot";
import { workerExecutionProfile } from "@/packages/worker-contracts";

const contract = {
  taskId: "11111111-1111-4111-8111-111111111111",
  attemptId: "22222222-2222-4222-8222-222222222222",
  executionClass: "repository_snapshot_github_public_v1" as const,
  absoluteDeadlineAt: "2026-08-27T04:00:00.000Z",
  budget: workerExecutionProfile("repository_snapshot_github_public_v1").budget,
  input: {
    kind: "repository_snapshot_github_public" as const,
    owner: "openai",
    repository: "openai-node",
    canonicalRepositoryUrl: "https://github.com/openai/openai-node",
    artifactUpload: {
      method: "PUT" as const,
      url: `https://scopeforge-artifacts.${"a".repeat(32)}.r2.cloudflarestorage.com/repository-source/${"b".repeat(64)}.tar.gz?X-Amz-Signature=test`,
      expiresAt: "2026-08-27T03:26:00.000Z",
    },
  },
};

function dependencies(overrides: Partial<RepositorySnapshotExecutorDependencies> = {}): RepositorySnapshotExecutorDependencies {
  return {
    github: {
      resolveRepository: vi.fn(async () => ({
        canonicalRepositoryUrl: contract.input.canonicalRepositoryUrl,
        defaultBranch: "main",
        commitSha: "c".repeat(40),
      })),
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
      artifactPath: "/tmp/scopeforge-test/repository-snapshot.tar.gz",
      contentDigest: "d".repeat(64),
      artifactDigest: "e".repeat(64),
      retainedFileCount: 0,
      retainedBytes: 0,
      storedArtifactBytes: 1234,
      skipCounts: { symlink: 0, hardlink: 0, fileTooLarge: 0, retainedFileLimit: 0, retainedBytesLimit: 0 },
    })),
    upload: vi.fn(async () => undefined),
    createWorkDirectory: vi.fn(async () => "/tmp/scopeforge-test"),
    removeWorkDirectory: vi.fn(async () => undefined),
    now: vi.fn(() => 1_000),
    cpuUsage: vi.fn(() => ({ user: 1_000, system: 1_000 })),
    memoryUsage: vi.fn(() => ({ rss: 100_000_000 })),
    ...overrides,
  };
}

describe("Phase 6B repository snapshot executor", () => {
  it("resolves an immutable commit, builds a snapshot, uploads it, and returns only bounded provenance", async () => {
    const deps = dependencies();
    const executor = createRepositorySnapshotExecutor(deps);
    const result = await executor.execute(contract, new AbortController().signal);

    expect(deps.github.openArchive).toHaveBeenCalledWith(
      "openai",
      "openai-node",
      "c".repeat(40),
      expect.any(AbortSignal),
    );
    expect(deps.upload).toHaveBeenCalledWith(expect.objectContaining({
      descriptor: contract.input.artifactUpload,
      artifactPath: "/tmp/scopeforge-test/repository-snapshot.tar.gz",
      storedArtifactBytes: 1234,
    }));
    expect(result).toMatchObject({
      executionClass: "repository_snapshot_github_public_v1",
      outcome: "succeeded",
      failureCode: null,
      result: {
        kind: "repository_snapshot_github_public",
        resolvedCommitSha: "c".repeat(40),
        contentDigest: "d".repeat(64),
        artifactDigest: "e".repeat(64),
        storedArtifactBytes: 1234,
      },
    });
    expect(JSON.stringify(result)).not.toContain("X-Amz-Signature");
    expect(JSON.stringify(result)).not.toContain("artifactUpload");
  });

  it("fails closed when GitHub resolves a different repository identity", async () => {
    const deps = dependencies({
      github: {
        resolveRepository: vi.fn(async () => ({
          canonicalRepositoryUrl: "https://github.com/other/repository",
          defaultBranch: "main",
          commitSha: "c".repeat(40),
        })),
        openArchive: vi.fn(),
      },
    });
    const result = await createRepositorySnapshotExecutor(deps).execute(contract, new AbortController().signal);
    expect(result).toMatchObject({ outcome: "failed", failureCode: "REPOSITORY_IDENTITY_CHANGED", result: null });
    expect(deps.github.openArchive).not.toHaveBeenCalled();
  });

  it("maps upload failures to the closed artifact failure code", async () => {
    const deps = dependencies({ upload: vi.fn(async () => { throw new Error("upload failed"); }) });
    const result = await createRepositorySnapshotExecutor(deps).execute(contract, new AbortController().signal);
    expect(result).toMatchObject({ outcome: "failed", failureCode: "REPOSITORY_ARTIFACT_UPLOAD_FAILED", result: null });
  });

  it("returns cancellation without attempting acquisition when already aborted", async () => {
    const deps = dependencies();
    const controller = new AbortController();
    controller.abort();
    const result = await createRepositorySnapshotExecutor(deps).execute(contract, controller.signal);
    expect(result).toMatchObject({ outcome: "cancelled", failureCode: null, result: null });
    expect(deps.github.resolveRepository).not.toHaveBeenCalled();
  });
});
