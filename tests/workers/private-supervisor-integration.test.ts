import { describe, expect, it, vi } from "vitest";
import {
  workerExecutionProfile,
  type WorkerTaskContract,
} from "@/packages/worker-contracts";
import {
  createWorkerExecutorDispatcher,
  runWorkerOnce,
} from "@/packages/worker-supervisor";

const TASK_ID = "11111111-1111-4111-8111-111111111111";
const ATTEMPT_ID = "22222222-2222-4222-8222-222222222222";
const COMMIT_SHA = "a".repeat(40);
const CANONICAL_URL = "https://github.com/scopeforge-labs/private-app";

function privateTask() {
  return {
    taskId: TASK_ID,
    attemptId: ATTEMPT_ID,
    executionClass: "repository_snapshot_github_private_v1" as const,
    leaseToken: "b".repeat(64),
    absoluteDeadlineAt: "2099-09-11T13:20:00.000Z",
    budget: workerExecutionProfile("repository_snapshot_github_private_v1").budget,
    input: {
      kind: "repository_snapshot_github_private" as const,
      owner: "scopeforge-labs",
      repository: "private-app",
      canonicalRepositoryUrl: CANONICAL_URL,
      privateArchiveLease: {
        kind: "github_private_archive_lease_v1" as const,
        canonicalRepositoryUrl: CANONICAL_URL,
        defaultBranch: "main",
        resolvedCommitSha: COMMIT_SHA,
        archiveUrl: `https://codeload.github.com/scopeforge-labs/private-app/legacy.tar.gz/${COMMIT_SHA}?token=attempt-only`,
        expiresAt: "2099-09-11T13:04:00.000Z",
      },
      artifactUpload: {
        method: "PUT" as const,
        url: `https://scopeforge-artifacts.example.r2.cloudflarestorage.com/repository-source/${"c".repeat(64)}.tar.gz?X-Amz-Signature=attempt-only`,
        expiresAt: "2099-09-11T13:04:00.000Z",
      },
    },
  };
}

function privateTerminal() {
  return {
    schemaVersion: 1 as const,
    taskId: TASK_ID,
    attemptId: ATTEMPT_ID,
    executionClass: "repository_snapshot_github_private_v1" as const,
    outcome: "succeeded" as const,
    failureCode: null,
    metrics: {
      wallTimeMs: 10,
      cpuTimeMs: 5,
      peakMemoryBytes: 1_000_000,
      inputBytes: 7,
      outputBytes: 512,
    },
    result: {
      kind: "repository_snapshot_github_private" as const,
      canonicalRepositoryUrl: CANONICAL_URL,
      defaultBranch: "main",
      resolvedCommitSha: COMMIT_SHA,
      contentDigest: "d".repeat(64),
      artifactDigest: "e".repeat(64),
      compressedBytes: 7,
      expandedBytes: 7,
      retainedFileCount: 1,
      retainedBytes: 7,
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
}

describe("Phase 10A2 private worker supervisor integration", () => {
  it("dispatches the private execution class only to the private snapshot executor", async () => {
    const privateExecute = vi.fn(async () => privateTerminal());
    const unexpectedExecute = vi.fn(async () => { throw new Error("wrong executor"); });
    const dispatcher = createWorkerExecutorDispatcher({
      foundation: { execute: unexpectedExecute },
      repositorySnapshot: { execute: unexpectedExecute },
      repositoryScan: { execute: unexpectedExecute },
      privateRepositorySnapshot: { execute: privateExecute },
    } as never);

    await expect(dispatcher.execute(
      privateTask() as never,
      new AbortController().signal,
    )).resolves.toEqual(privateTerminal());
    expect(privateExecute).toHaveBeenCalledTimes(1);
    expect(unexpectedExecute).not.toHaveBeenCalled();
  });

  it("preserves a successful private terminal through trusted supervisor finalization", async () => {
    const task = privateTask();
    const finalize = vi.fn(async () => ({ outcome: "succeeded" as const, replayed: false }));
    const execute = vi.fn(async () => privateTerminal());

    await expect(runWorkerOnce({
      control: {
        claim: vi.fn(async () => task as unknown as WorkerTaskContract),
        heartbeat: vi.fn(async () => ({
          cancelRequested: false,
          leaseExpiresAt: "2099-09-11T13:01:30.000Z",
        })),
        finalize,
      },
      executor: { execute } as never,
      heartbeatMs: 60_000,
    })).resolves.toEqual({ status: "completed", outcome: "succeeded", replayed: false });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledWith({
      leaseToken: task.leaseToken,
      terminal: privateTerminal(),
    });
  });
});
