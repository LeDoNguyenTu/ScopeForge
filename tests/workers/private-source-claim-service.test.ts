import { describe, expect, it, vi } from "vitest";
import type { RepositorySnapshotObjectStore } from "@/lib/repository-snapshots/object-store";
import {
  claimWorkerTaskForNode,
  type WorkerControlRepository,
} from "@/lib/worker-control/service";
import { workerExecutionProfile } from "@/packages/worker-contracts";

const WORKER_ID = "11111111-1111-4111-8111-111111111111";
const TASK_ID = "22222222-2222-4222-8222-222222222222";
const ATTEMPT_ID = "33333333-3333-4333-8333-333333333333";
const LINK_ID = "44444444-4444-4444-8444-444444444444";

function privateRepositoryClaim() {
  return {
    taskId: TASK_ID,
    attemptId: ATTEMPT_ID,
    executionClass: "repository_snapshot_github_private_v1" as const,
    leaseToken: "a".repeat(64),
    leaseExpiresAt: "2026-09-11T13:01:30.000Z",
    absoluteDeadlineAt: "2026-09-11T13:20:00.000Z",
    budget: workerExecutionProfile("repository_snapshot_github_private_v1").budget,
    artifactObjectKey: `repository-source/${"b".repeat(64)}.tar.gz`,
    installationId: 7001,
    repositoryId: 9001,
    input: {
      kind: "repository_snapshot_github_private" as const,
      owner: "scopeforge-labs",
      repository: "private-app",
      canonicalRepositoryUrl: "https://github.com/scopeforge-labs/private-app",
      githubRepositoryLinkId: LINK_ID,
    },
  };
}

describe("private repository worker claim composition", () => {
  it("brokers an attempt-bound private archive lease and strips control-plane identifiers", async () => {
    const claim = privateRepositoryClaim();
    const repository = {
      claim: vi.fn(async () => claim),
    } as unknown as WorkerControlRepository;
    const privateRepositorySourceLease = vi.fn(async () => ({
      kind: "github_private_archive_lease_v1" as const,
      canonicalRepositoryUrl: claim.input.canonicalRepositoryUrl,
      defaultBranch: "main",
      resolvedCommitSha: "c".repeat(40),
      archiveUrl: `https://codeload.github.com/scopeforge-labs/private-app/legacy.tar.gz/${"c".repeat(40)}`,
      expiresAt: claim.leaseExpiresAt,
    }));
    const createAttemptUpload = vi.fn(async () => ({
      method: "PUT" as const,
      url: "https://scopeforge-artifacts.example.r2.cloudflarestorage.com/object?X-Amz-Signature=test",
      expiresAt: claim.leaseExpiresAt,
    }));
    const objectStore = {
      createAttemptUpload,
      createAttemptDownload: vi.fn(),
      headObject: vi.fn(),
      deleteObject: vi.fn(),
    } as RepositorySnapshotObjectStore;

    const result = await claimWorkerTaskForNode({
      workerId: WORKER_ID,
      executionClass: "repository_snapshot_github_private_v1",
      softwareVersion: "0.1.0",
    }, {
      repository,
      repositorySnapshotObjectStore: () => objectStore,
      privateRepositorySourceLease,
      now: () => new Date("2026-09-11T13:00:00.000Z"),
    });

    expect(privateRepositorySourceLease).toHaveBeenCalledWith({
      installationId: 7001,
      repositoryId: 9001,
      owner: claim.input.owner,
      repository: claim.input.repository,
      canonicalRepositoryUrl: claim.input.canonicalRepositoryUrl,
      absoluteDeadlineAt: claim.absoluteDeadlineAt,
      leaseExpiresAt: claim.leaseExpiresAt,
    });
    expect(createAttemptUpload).toHaveBeenCalledWith({
      objectKey: claim.artifactObjectKey,
      expiresAt: new Date(claim.leaseExpiresAt),
    });
    expect(result?.input).toMatchObject({
      kind: "repository_snapshot_github_private",
      owner: claim.input.owner,
      repository: claim.input.repository,
      canonicalRepositoryUrl: claim.input.canonicalRepositoryUrl,
      privateArchiveLease: { kind: "github_private_archive_lease_v1" },
      artifactUpload: { method: "PUT" },
    });
    expect(result?.input).not.toHaveProperty("githubRepositoryLinkId");
    expect(JSON.stringify(result)).not.toContain(String(claim.installationId));
    expect(JSON.stringify(result)).not.toContain(String(claim.repositoryId));
    expect(JSON.stringify(result)).not.toContain(claim.artifactObjectKey);
  });
});
