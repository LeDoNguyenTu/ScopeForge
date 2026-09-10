import { describe, expect, it, vi } from "vitest";
import { resumeConnectedProjectScan } from "@/lib/project-scans/service";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const ASSET_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const LINK_ID = "44444444-4444-4444-8444-444444444444";
const CONNECTION_ID = "55555555-5555-4555-8555-555555555555";
const SNAPSHOT_TASK_ID = "66666666-6666-4666-8666-666666666666";
const SNAPSHOT_ID = "77777777-7777-4777-8777-777777777777";
const SCAN_TASK_ID = "88888888-8888-4888-8888-888888888888";
const SCAN_JOB_ID = "99999999-9999-4999-8999-999999999999";

function dependencies(overrides: Record<string, unknown> = {}) {
  const continuation = {
    workspaceId: WORKSPACE_ID,
    assetId: ASSET_ID,
    actorId: USER_ID,
    linkId: LINK_ID,
    repositoryId: 9001,
    canonicalTarget: "https://github.com/scopeforge-labs/app",
    isPrivate: false,
    accessStatus: "active" as const,
    snapshotTaskId: SNAPSHOT_TASK_ID,
    snapshotId: SNAPSHOT_ID,
    state: "waiting_scan_runtime" as const,
  };
  return {
    loadAuthorizedProject: vi.fn(async () => ({
      workspaceId: WORKSPACE_ID,
      assetId: ASSET_ID,
      actorId: USER_ID,
      linkId: LINK_ID,
      connectionId: CONNECTION_ID,
      installationId: 7001,
      repositoryId: 9001,
      canonicalTarget: "https://github.com/scopeforge-labs/app",
      isPrivate: false,
      accessStatus: "active" as const,
    })),
    revalidateRepository: vi.fn(async () => ({
      id: 9001,
      ownerLogin: "scopeforge-labs",
      name: "app",
      fullName: "scopeforge-labs/app",
      defaultBranch: "main",
      isPrivate: false,
      htmlUrl: "https://github.com/scopeforge-labs/app",
    })),
    snapshotRuntimeEnabled: () => false,
    scanRuntimeEnabled: () => true,
    enqueueSnapshotIntent: vi.fn(async () => { throw new Error("resume must not create another snapshot"); }),
    loadRecovery: vi.fn(async () => ({
      snapshotTaskId: SNAPSHOT_TASK_ID,
      snapshotId: SNAPSHOT_ID,
      state: "waiting_scan_runtime" as const,
    })),
    loadContinuation: vi.fn(async () => continuation),
    markWaitingForScanRuntime: vi.fn(async () => undefined),
    enqueueScanContinuation: vi.fn(async () => ({ taskId: SCAN_TASK_ID, scanJobId: SCAN_JOB_ID, replayed: false })),
    recordRetryPending: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("connected project scan recovery", () => {
  it("resumes a waiting published snapshot without creating another snapshot", async () => {
    const deps = dependencies();
    await expect(resumeConnectedProjectScan({
      workspaceId: WORKSPACE_ID,
      assetId: ASSET_ID,
      actorId: USER_ID,
    }, deps as never)).resolves.toEqual({
      status: "scan_queued",
      taskId: SCAN_TASK_ID,
      scanJobId: SCAN_JOB_ID,
      replayed: false,
    });

    expect(deps.revalidateRepository).toHaveBeenCalledTimes(1);
    expect(deps.loadRecovery).toHaveBeenCalledWith(expect.objectContaining({ linkId: LINK_ID }));
    expect(deps.enqueueSnapshotIntent).not.toHaveBeenCalled();
    expect(deps.enqueueScanContinuation).toHaveBeenCalledTimes(1);
  });

  it("resumes retry-pending continuation through the same idempotent scan enqueue", async () => {
    const deps = dependencies({
      loadRecovery: vi.fn(async () => ({
        snapshotTaskId: SNAPSHOT_TASK_ID,
        snapshotId: SNAPSHOT_ID,
        state: "retry_pending" as const,
      })),
      loadContinuation: vi.fn(async () => ({
        workspaceId: WORKSPACE_ID,
        assetId: ASSET_ID,
        actorId: USER_ID,
        linkId: LINK_ID,
        repositoryId: 9001,
        canonicalTarget: "https://github.com/scopeforge-labs/app",
        isPrivate: false,
        accessStatus: "active" as const,
        snapshotTaskId: SNAPSHOT_TASK_ID,
        snapshotId: SNAPSHOT_ID,
        state: "retry_pending" as const,
      })),
    });

    await expect(resumeConnectedProjectScan({
      workspaceId: WORKSPACE_ID,
      assetId: ASSET_ID,
      actorId: USER_ID,
    }, deps as never)).resolves.toMatchObject({ status: "scan_queued" });
    expect(deps.enqueueSnapshotIntent).not.toHaveBeenCalled();
  });

  it("keeps recovery fail-closed while the repository scan runtime is disabled", async () => {
    const deps = dependencies({ scanRuntimeEnabled: () => false });
    await expect(resumeConnectedProjectScan({
      workspaceId: WORKSPACE_ID,
      assetId: ASSET_ID,
      actorId: USER_ID,
    }, deps as never)).resolves.toEqual({ status: "scan_runtime_unavailable" });
    expect(deps.enqueueScanContinuation).not.toHaveBeenCalled();
    expect(deps.enqueueSnapshotIntent).not.toHaveBeenCalled();
  });

  it("reports no pending continuation instead of creating a fresh snapshot", async () => {
    const deps = dependencies({ loadRecovery: vi.fn(async () => null) });
    await expect(resumeConnectedProjectScan({
      workspaceId: WORKSPACE_ID,
      assetId: ASSET_ID,
      actorId: USER_ID,
    }, deps as never)).resolves.toEqual({ status: "no_pending_scan" });
    expect(deps.enqueueScanContinuation).not.toHaveBeenCalled();
    expect(deps.enqueueSnapshotIntent).not.toHaveBeenCalled();
  });
});
