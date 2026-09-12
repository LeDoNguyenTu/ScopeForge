import { describe, expect, it, vi } from "vitest";
import {
  continueConnectedProjectScanAfterSnapshot,
  type ProjectScanServiceDependencies,
} from "@/lib/project-scans/service";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const ASSET_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const LINK_ID = "44444444-4444-4444-8444-444444444444";
const SNAPSHOT_TASK_ID = "55555555-5555-4555-8555-555555555555";
const SNAPSHOT_ID = "66666666-6666-4666-8666-666666666666";
const SCAN_TASK_ID = "77777777-7777-4777-8777-777777777777";
const SCAN_JOB_ID = "88888888-8888-4888-8888-888888888888";

function dependencies(overrides: Partial<ProjectScanServiceDependencies> = {}): ProjectScanServiceDependencies {
  return {
    loadAuthorizedProject: vi.fn(async () => { throw new Error("unused"); }),
    revalidateRepository: vi.fn(async () => { throw new Error("unused"); }),
    snapshotRuntimeEnabled: () => true,
    scanRuntimeEnabled: () => true,
    enqueueSnapshotIntent: vi.fn(async () => ({ taskId: SNAPSHOT_TASK_ID })),
    loadRecovery: vi.fn(async () => null),
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
      state: "snapshot_queued" as const,
    })),
    markWaitingForScanRuntime: vi.fn(async () => undefined),
    enqueueScanContinuation: vi.fn(async () => ({ taskId: SCAN_TASK_ID, scanJobId: SCAN_JOB_ID, replayed: false })),
    recordRetryPending: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("connected project snapshot continuation", () => {
  it("continues a published snapshot into the existing repository scan enqueue boundary", async () => {
    const deps = dependencies();
    await expect(continueConnectedProjectScanAfterSnapshot({ snapshotTaskId: SNAPSHOT_TASK_ID, snapshotId: SNAPSHOT_ID }, deps))
      .resolves.toEqual({ status: "scan_queued", taskId: SCAN_TASK_ID, scanJobId: SCAN_JOB_ID, replayed: false });
    expect(deps.enqueueScanContinuation).toHaveBeenCalledWith(expect.objectContaining({
      snapshotTaskId: SNAPSHOT_TASK_ID,
      snapshotId: SNAPSHOT_ID,
      workspaceId: WORKSPACE_ID,
      assetId: ASSET_ID,
    }));
  });

  it("records a truthful waiting state when hosted repository scanning is disabled", async () => {
    const deps = dependencies({ scanRuntimeEnabled: () => false });
    await expect(continueConnectedProjectScanAfterSnapshot({ snapshotTaskId: SNAPSHOT_TASK_ID, snapshotId: SNAPSHOT_ID }, deps))
      .resolves.toEqual({ status: "waiting_scan_runtime" });
    expect(deps.markWaitingForScanRuntime).toHaveBeenCalledWith(expect.objectContaining({
      snapshotTaskId: SNAPSHOT_TASK_ID,
      snapshotId: SNAPSHOT_ID,
    }));
    expect(deps.enqueueScanContinuation).not.toHaveBeenCalled();
  });

  it("treats an already-completed atomic continuation as an idempotent replay", async () => {
    const deps = dependencies({
      enqueueScanContinuation: vi.fn(async () => ({ taskId: SCAN_TASK_ID, scanJobId: SCAN_JOB_ID, replayed: true })),
    });
    await expect(continueConnectedProjectScanAfterSnapshot({ snapshotTaskId: SNAPSHOT_TASK_ID, snapshotId: SNAPSHOT_ID }, deps))
      .resolves.toEqual({ status: "scan_queued", taskId: SCAN_TASK_ID, scanJobId: SCAN_JOB_ID, replayed: true });
  });

  it("does not downgrade an already-queued scan when the runtime gate is later disabled", async () => {
    const deps = dependencies({
      scanRuntimeEnabled: () => false,
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
        state: "scan_queued" as const,
      })),
      enqueueScanContinuation: vi.fn(async () => ({ taskId: SCAN_TASK_ID, scanJobId: SCAN_JOB_ID, replayed: true })),
    });

    await expect(continueConnectedProjectScanAfterSnapshot({ snapshotTaskId: SNAPSHOT_TASK_ID, snapshotId: SNAPSHOT_ID }, deps))
      .resolves.toEqual({ status: "scan_queued", taskId: SCAN_TASK_ID, scanJobId: SCAN_JOB_ID, replayed: true });
    expect(deps.enqueueScanContinuation).toHaveBeenCalledTimes(1);
    expect(deps.markWaitingForScanRuntime).not.toHaveBeenCalled();
  });

  it("ignores successful snapshots that have no connected-project scan intent", async () => {
    const deps = dependencies({ loadContinuation: vi.fn(async () => null) });
    await expect(continueConnectedProjectScanAfterSnapshot({ snapshotTaskId: SNAPSHOT_TASK_ID, snapshotId: SNAPSHOT_ID }, deps))
      .resolves.toEqual({ status: "ignored" });
    expect(deps.enqueueScanContinuation).not.toHaveBeenCalled();
  });

  it("never sends a private project into the public snapshot continuation path", async () => {
    const deps = dependencies({
      loadContinuation: vi.fn(async () => ({
        workspaceId: WORKSPACE_ID,
        assetId: ASSET_ID,
        actorId: USER_ID,
        linkId: LINK_ID,
        repositoryId: 9001,
        canonicalTarget: "https://github.com/scopeforge-labs/private-app",
        isPrivate: true,
        accessStatus: "active" as const,
        snapshotTaskId: SNAPSHOT_TASK_ID,
        snapshotId: SNAPSHOT_ID,
        state: "snapshot_queued" as const,
      })),
    });
    await expect(continueConnectedProjectScanAfterSnapshot({ snapshotTaskId: SNAPSHOT_TASK_ID, snapshotId: SNAPSHOT_ID }, deps))
      .resolves.toEqual({ status: "ignored" });
    expect(deps.enqueueScanContinuation).not.toHaveBeenCalled();
  });

  it("records retry-pending state instead of throwing after immutable snapshot publication", async () => {
    const deps = dependencies({
      enqueueScanContinuation: vi.fn(async () => { throw new Error("database secret body"); }),
    });
    await expect(continueConnectedProjectScanAfterSnapshot({ snapshotTaskId: SNAPSHOT_TASK_ID, snapshotId: SNAPSHOT_ID }, deps))
      .resolves.toEqual({ status: "retry_pending" });
    expect(deps.recordRetryPending).toHaveBeenCalledWith(expect.objectContaining({
      snapshotTaskId: SNAPSHOT_TASK_ID,
      snapshotId: SNAPSHOT_ID,
    }));
  });
});
