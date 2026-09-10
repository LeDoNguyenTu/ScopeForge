import { describe, expect, it, vi } from "vitest";
import {
  ProjectScanError,
  requestConnectedProjectScan,
  type ProjectScanServiceDependencies,
} from "@/lib/project-scans/service";
import type { GitHubRepositorySummary } from "@/lib/github-app/types";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const ASSET_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const LINK_ID = "44444444-4444-4444-8444-444444444444";
const CONNECTION_ID = "55555555-5555-4555-8555-555555555555";

const repository: GitHubRepositorySummary = {
  id: 9001,
  ownerLogin: "scopeforge-labs",
  name: "app",
  fullName: "scopeforge-labs/app",
  defaultBranch: "main",
  isPrivate: false,
  htmlUrl: "https://github.com/scopeforge-labs/app",
};

function dependencies(overrides: Partial<ProjectScanServiceDependencies> = {}): ProjectScanServiceDependencies {
  return {
    loadAuthorizedProject: vi.fn(async () => ({
      workspaceId: WORKSPACE_ID,
      assetId: ASSET_ID,
      actorId: USER_ID,
      linkId: LINK_ID,
      connectionId: CONNECTION_ID,
      installationId: 7001,
      repositoryId: repository.id,
      canonicalTarget: repository.htmlUrl,
      isPrivate: false,
      accessStatus: "active" as const,
    })),
    revalidateRepository: vi.fn(async () => repository),
    snapshotRuntimeEnabled: () => true,
    scanRuntimeEnabled: () => true,
    enqueueSnapshotIntent: vi.fn(async () => ({ taskId: "66666666-6666-4666-8666-666666666666" })),
    loadContinuation: vi.fn(async () => null),
    markWaitingForScanRuntime: vi.fn(async () => undefined),
    enqueueScanContinuation: vi.fn(async () => ({ taskId: "77777777-7777-4777-8777-777777777777", scanJobId: "88888888-8888-4888-8888-888888888888", replayed: false })),
    recordRetryPending: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("connected project scan request", () => {
  it("revalidates GitHub access before creating a snapshot intent", async () => {
    const deps = dependencies();
    await expect(requestConnectedProjectScan({ workspaceId: WORKSPACE_ID, assetId: ASSET_ID, actorId: USER_ID }, deps))
      .resolves.toEqual({ status: "snapshot_queued", taskId: "66666666-6666-4666-8666-666666666666" });
    expect(deps.revalidateRepository).toHaveBeenCalledTimes(1);
    expect(deps.enqueueSnapshotIntent).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: WORKSPACE_ID,
      assetId: ASSET_ID,
      actorId: USER_ID,
      repositoryId: repository.id,
    }));
  });

  it("rejects stale or mismatched provider identity before enqueueing", async () => {
    const deps = dependencies({
      revalidateRepository: vi.fn(async () => ({ ...repository, id: 9999 })),
    });
    await expect(requestConnectedProjectScan({ workspaceId: WORKSPACE_ID, assetId: ASSET_ID, actorId: USER_ID }, deps))
      .rejects.toEqual(expect.objectContaining<Partial<ProjectScanError>>({ code: "PROJECT_SCAN_REPOSITORY_MISMATCH" }));
    expect(deps.enqueueSnapshotIntent).not.toHaveBeenCalled();
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
  });

  it("keeps private repositories linked but outside public acquisition", async () => {
    const deps = dependencies({
      loadAuthorizedProject: vi.fn(async () => ({
        workspaceId: WORKSPACE_ID,
        assetId: ASSET_ID,
        actorId: USER_ID,
        linkId: LINK_ID,
        connectionId: CONNECTION_ID,
        installationId: 7001,
        repositoryId: repository.id,
        canonicalTarget: repository.htmlUrl,
        isPrivate: true,
        accessStatus: "active" as const,
      })),
      revalidateRepository: vi.fn(async () => ({ ...repository, isPrivate: true })),
    });
    await expect(requestConnectedProjectScan({ workspaceId: WORKSPACE_ID, assetId: ASSET_ID, actorId: USER_ID }, deps))
      .resolves.toEqual({ status: "private_acquisition_required" });
    expect(deps.enqueueSnapshotIntent).not.toHaveBeenCalled();
  });

  it("does not bypass the hosted snapshot runtime gate", async () => {
    const deps = dependencies({ snapshotRuntimeEnabled: () => false });
    await expect(requestConnectedProjectScan({ workspaceId: WORKSPACE_ID, assetId: ASSET_ID, actorId: USER_ID }, deps))
      .resolves.toEqual({ status: "snapshot_runtime_unavailable" });
    expect(deps.enqueueSnapshotIntent).not.toHaveBeenCalled();
  });
});
