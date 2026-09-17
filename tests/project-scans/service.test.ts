import { describe, expect, it, vi } from "vitest";
import {
  continueConnectedProjectScanAfterSnapshot,
  ProjectScanError,
  requestConnectedProjectScan,
  resumeConnectedProjectScan,
  type ProjectScanServiceDependencies,
} from "@/lib/project-scans/service";
import type { GitHubRepositorySummary } from "@/lib/github-app/types";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const ASSET_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const LINK_ID = "44444444-4444-4444-8444-444444444444";
const CONNECTION_ID = "55555555-5555-4555-8555-555555555555";
const PUBLIC_SNAPSHOT_TASK_ID = "66666666-6666-4666-8666-666666666666";
const PRIVATE_SNAPSHOT_TASK_ID = "77777777-7777-4777-8777-777777777777";
const SNAPSHOT_ID = "88888888-8888-4888-8888-888888888888";
const SCAN_TASK_ID = "99999999-9999-4999-8999-999999999999";
const SCAN_JOB_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const repository: GitHubRepositorySummary = {
  id: 9001,
  ownerLogin: "scopeforge-labs",
  name: "app",
  fullName: "scopeforge-labs/app",
  defaultBranch: "main",
  isPrivate: false,
  isArchived: false,
  htmlUrl: "https://github.com/scopeforge-labs/app",
};

function projectContext(isPrivate = false) {
  return {
    workspaceId: WORKSPACE_ID,
    assetId: ASSET_ID,
    actorId: USER_ID,
    linkId: LINK_ID,
    connectionId: CONNECTION_ID,
    installationId: 7001,
    repositoryId: repository.id,
    canonicalTarget: repository.htmlUrl,
    isPrivate,
    accessStatus: "active" as const,
  };
}

function dependencies(overrides: Partial<ProjectScanServiceDependencies> = {}): ProjectScanServiceDependencies {
  return {
    loadAuthorizedProject: vi.fn(async () => projectContext()),
    revalidateRepository: vi.fn(async () => repository),
    snapshotRuntimeEnabled: () => true,
    privateSnapshotRuntimeEnabled: () => true,
    scanRuntimeEnabled: () => true,
    enqueueSnapshotIntent: vi.fn(async () => ({ taskId: PUBLIC_SNAPSHOT_TASK_ID })),
    enqueuePrivateSnapshotIntent: vi.fn(async () => ({ taskId: PRIVATE_SNAPSHOT_TASK_ID })),
    loadRecovery: vi.fn(async () => null),
    loadContinuation: vi.fn(async () => null),
    markWaitingForScanRuntime: vi.fn(async () => undefined),
    enqueueScanContinuation: vi.fn(async () => ({ taskId: SCAN_TASK_ID, scanJobId: SCAN_JOB_ID, replayed: false })),
    recordRetryPending: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("connected project scan request", () => {
  it("revalidates GitHub access before creating a public snapshot intent", async () => {
    const deps = dependencies();
    await expect(requestConnectedProjectScan({ workspaceId: WORKSPACE_ID, assetId: ASSET_ID, actorId: USER_ID }, deps))
      .resolves.toEqual({ status: "snapshot_queued", taskId: PUBLIC_SNAPSHOT_TASK_ID });
    expect(deps.revalidateRepository).toHaveBeenCalledTimes(1);
    expect(deps.enqueueSnapshotIntent).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: WORKSPACE_ID,
      assetId: ASSET_ID,
      actorId: USER_ID,
      repositoryId: repository.id,
    }));
    expect(deps.enqueuePrivateSnapshotIntent).not.toHaveBeenCalled();
  });

  it("queues the private snapshot class when the private runtime gate is enabled", async () => {
    const deps = dependencies({
      loadAuthorizedProject: vi.fn(async () => projectContext(true)),
      revalidateRepository: vi.fn(async () => ({ ...repository, isPrivate: true })),
    });

    await expect(requestConnectedProjectScan({ workspaceId: WORKSPACE_ID, assetId: ASSET_ID, actorId: USER_ID }, deps))
      .resolves.toEqual({ status: "snapshot_queued", taskId: PRIVATE_SNAPSHOT_TASK_ID });
    expect(deps.enqueuePrivateSnapshotIntent).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: WORKSPACE_ID,
      assetId: ASSET_ID,
      actorId: USER_ID,
      linkId: LINK_ID,
      isPrivate: true,
    }));
    expect(deps.enqueueSnapshotIntent).not.toHaveBeenCalled();
  });

  it("returns a private runtime gate result without silently falling back to public acquisition", async () => {
    const deps = dependencies({
      loadAuthorizedProject: vi.fn(async () => projectContext(true)),
      revalidateRepository: vi.fn(async () => ({ ...repository, isPrivate: true })),
      privateSnapshotRuntimeEnabled: () => false,
    });

    await expect(requestConnectedProjectScan({ workspaceId: WORKSPACE_ID, assetId: ASSET_ID, actorId: USER_ID }, deps))
      .resolves.toEqual({ status: "private_snapshot_runtime_unavailable" });
    expect(deps.enqueuePrivateSnapshotIntent).not.toHaveBeenCalled();
    expect(deps.enqueueSnapshotIntent).not.toHaveBeenCalled();
  });

  it("rejects stale or mismatched provider identity before enqueueing", async () => {
    const deps = dependencies({
      revalidateRepository: vi.fn(async () => ({ ...repository, id: 9999 })),
    });
    await expect(requestConnectedProjectScan({ workspaceId: WORKSPACE_ID, assetId: ASSET_ID, actorId: USER_ID }, deps))
      .rejects.toEqual(expect.objectContaining<Partial<ProjectScanError>>({ code: "PROJECT_SCAN_REPOSITORY_MISMATCH" }));
    expect(deps.enqueueSnapshotIntent).not.toHaveBeenCalled();
    expect(deps.enqueuePrivateSnapshotIntent).not.toHaveBeenCalled();
  });

  it("fails closed when repository visibility changes instead of switching acquisition classes", async () => {
    const deps = dependencies({
      revalidateRepository: vi.fn(async () => ({ ...repository, isPrivate: true })),
    });
    await expect(requestConnectedProjectScan({ workspaceId: WORKSPACE_ID, assetId: ASSET_ID, actorId: USER_ID }, deps))
      .rejects.toEqual(expect.objectContaining<Partial<ProjectScanError>>({ code: "PROJECT_SCAN_REPOSITORY_MISMATCH" }));
    expect(deps.enqueueSnapshotIntent).not.toHaveBeenCalled();
    expect(deps.enqueuePrivateSnapshotIntent).not.toHaveBeenCalled();
  });

  it("fails safely when provider revalidation fails", async () => {
    const deps = dependencies({
      revalidateRepository: vi.fn(async () => { throw new Error("provider-secret-body"); }),
    });
    await expect(requestConnectedProjectScan({ workspaceId: WORKSPACE_ID, assetId: ASSET_ID, actorId: USER_ID }, deps))
      .rejects.toEqual(expect.objectContaining<Partial<ProjectScanError>>({
        code: "PROJECT_SCAN_PROVIDER_FAILED",
        message: "GitHub repository access could not be verified safely.",
      }));
    expect(deps.enqueueSnapshotIntent).not.toHaveBeenCalled();
    expect(deps.enqueuePrivateSnapshotIntent).not.toHaveBeenCalled();
  });

  it("does not bypass the hosted public snapshot runtime gate", async () => {
    const deps = dependencies({ snapshotRuntimeEnabled: () => false });
    await expect(requestConnectedProjectScan({ workspaceId: WORKSPACE_ID, assetId: ASSET_ID, actorId: USER_ID }, deps))
      .resolves.toEqual({ status: "snapshot_runtime_unavailable" });
    expect(deps.enqueueSnapshotIntent).not.toHaveBeenCalled();
    expect(deps.enqueuePrivateSnapshotIntent).not.toHaveBeenCalled();
  });
});

describe("connected private project continuation and recovery", () => {
  it("moves a published private snapshot into the same waiting scan-runtime state", async () => {
    const privateContinuation = {
      ...projectContext(true),
      snapshotTaskId: PRIVATE_SNAPSHOT_TASK_ID,
      snapshotId: SNAPSHOT_ID,
      state: "snapshot_queued" as const,
    };
    const deps = dependencies({
      scanRuntimeEnabled: () => false,
      loadContinuation: vi.fn(async () => privateContinuation),
    });

    await expect(continueConnectedProjectScanAfterSnapshot({
      snapshotTaskId: PRIVATE_SNAPSHOT_TASK_ID,
      snapshotId: SNAPSHOT_ID,
    }, deps)).resolves.toEqual({ status: "waiting_scan_runtime" });
    expect(deps.markWaitingForScanRuntime).toHaveBeenCalledWith(privateContinuation);
    expect(deps.enqueueScanContinuation).not.toHaveBeenCalled();
  });

  it("recovers a published private snapshot against the exact snapshot after provider revalidation", async () => {
    const privateContext = projectContext(true);
    const recovery = {
      snapshotTaskId: PRIVATE_SNAPSHOT_TASK_ID,
      snapshotId: SNAPSHOT_ID,
      state: "waiting_scan_runtime" as const,
    };
    const continuation = {
      ...privateContext,
      snapshotTaskId: PRIVATE_SNAPSHOT_TASK_ID,
      snapshotId: SNAPSHOT_ID,
      state: "waiting_scan_runtime" as const,
    };
    const deps = dependencies({
      loadAuthorizedProject: vi.fn(async () => privateContext),
      revalidateRepository: vi.fn(async () => ({ ...repository, isPrivate: true })),
      loadRecovery: vi.fn(async () => recovery),
      loadContinuation: vi.fn(async () => continuation),
    });

    await expect(resumeConnectedProjectScan({
      workspaceId: WORKSPACE_ID,
      assetId: ASSET_ID,
      actorId: USER_ID,
    }, deps)).resolves.toEqual({
      status: "scan_queued",
      taskId: SCAN_TASK_ID,
      scanJobId: SCAN_JOB_ID,
      replayed: false,
    });
    expect(deps.revalidateRepository).toHaveBeenCalledTimes(1);
    expect(deps.enqueueScanContinuation).toHaveBeenCalledWith(continuation);
  });
});
