import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  processGitHubWebhook,
  type GitHubWebhookRepositoryContext,
  type GitHubWebhookServiceDependencies,
} from "@/lib/github-app/webhook-service";
import type {
  GitHubAppConfig,
  GitHubRepositorySummary,
} from "@/lib/github-app/types";
import type { VerifiedGitHubWebhookRequest } from "@/lib/github-app/webhook";

const DELIVERY_ID = "11111111-1111-4111-8111-111111111111";
const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";
const CONNECTION_ID = "33333333-3333-4333-8333-333333333333";
const LINK_ID = "44444444-4444-4444-8444-444444444444";
const ASSET_ID = "55555555-5555-4555-8555-555555555555";
const INSTALLED_BY = "66666666-6666-4666-8666-666666666666";
const TASK_ID = "77777777-7777-4777-8777-777777777777";
const SCAN_JOB_ID = "88888888-8888-4888-8888-888888888888";
const INSTALLATION_ID = 7001;
const REPOSITORY_ID = 9001;
const HEAD_SHA = "a".repeat(40);
const STALE_SHA = "b".repeat(40);
const ZERO_SHA = "0".repeat(40);

const config: GitHubAppConfig = {
  appId: "12345",
  clientId: "Iv1.client123",
  clientSecret: "x".repeat(32),
  privateKey: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
  slug: "scopeforge-test",
  stateSecret: "s".repeat(32),
  webhookSecret: "w".repeat(32),
};

const repository: GitHubRepositorySummary = {
  id: REPOSITORY_ID,
  ownerLogin: "scopeforge-labs",
  name: "secure-app",
  fullName: "scopeforge-labs/secure-app",
  defaultBranch: "main",
  isPrivate: false,
  isArchived: false,
  htmlUrl: "https://github.com/scopeforge-labs/secure-app",
};

const context: GitHubWebhookRepositoryContext = {
  workspaceId: WORKSPACE_ID,
  connectionId: CONNECTION_ID,
  linkId: LINK_ID,
  assetId: ASSET_ID,
  installationId: INSTALLATION_ID,
  repositoryId: REPOSITORY_ID,
  installedBy: INSTALLED_BY,
  connectionStatus: "active",
  accessStatus: "active",
  autoScanEnabled: true,
  ownerLogin: repository.ownerLogin,
  repositoryName: repository.name,
  fullName: repository.fullName,
  defaultBranch: repository.defaultBranch,
  isPrivate: repository.isPrivate,
  htmlUrl: repository.htmlUrl,
  providerArchived: false,
  desiredCommitSha: null,
  successfulCommitSha: null,
  pending: false,
};

function verified(
  event: string,
  payload: Record<string, unknown> = {},
): VerifiedGitHubWebhookRequest {
  return {
    deliveryId: DELIVERY_ID,
    event,
    rawBody: new Uint8Array([1, 2, 3]),
    payload,
  };
}

function pushPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    installation: { id: INSTALLATION_ID },
    repository: {
      id: REPOSITORY_ID,
      private: true,
      html_url: "https://github.com/attacker/forged",
      default_branch: "attacker-controlled",
    },
    ref: "refs/heads/main",
    after: HEAD_SHA,
    deleted: false,
    ...overrides,
  };
}

function dependencies(
  overrides: Partial<GitHubWebhookServiceDependencies> = {},
): GitHubWebhookServiceDependencies {
  return {
    getConfig: () => config,
    admitDelivery: vi.fn(async () => ({ admitted: true, replayed: false })),
    loadRepositoryContext: vi.fn(async () => context),
    createInstallationToken: vi.fn(async () => ({
      token: "installation-secret",
      expiresAt: "2026-09-12T01:00:00.000Z",
    })),
    getInstallationRepository: vi.fn(async () => repository),
    getDefaultBranchHead: vi.fn(async () => HEAD_SHA),
    reconcileRepository: vi.fn(async () => ({ matched: true })),
    recordPushHead: vi.fn(async () => ({
      replayed: false,
      shouldEnqueue: true,
      coalesced: false,
      ignored: false,
      desiredCommitSha: HEAD_SHA,
    })),
    publicSnapshotRuntimeEnabled: () => true,
    privateSnapshotRuntimeEnabled: () => true,
    enqueueProjectSnapshot: vi.fn(async () => ({
      replayed: false,
      taskId: TASK_ID,
      scanJobId: SCAN_JOB_ID,
      executionClass: "repository_snapshot_github_public_v1" as const,
      desiredCommitSha: HEAD_SHA,
    })),
    recordDeliveryResult: vi.fn(async () => undefined),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GitHub webhook reconciliation service", () => {
  it("accepts ping without provider, persistence, or scan side effects", async () => {
    const deps = dependencies();

    await expect(processGitHubWebhook(verified("ping", { zen: "keep it logically awesome" }), deps))
      .resolves.toEqual({ status: "accepted", code: "PING" });

    expect(deps.admitDelivery).not.toHaveBeenCalled();
    expect(deps.loadRepositoryContext).not.toHaveBeenCalled();
    expect(deps.createInstallationToken).not.toHaveBeenCalled();
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
    expect(deps.recordDeliveryResult).not.toHaveBeenCalled();
  });

  it("ignores unsupported events without delivery persistence", async () => {
    const deps = dependencies();

    await expect(processGitHubWebhook(verified("issues", { action: "opened" }), deps))
      .resolves.toEqual({ status: "ignored", code: "EVENT_UNSUPPORTED" });

    expect(deps.admitDelivery).not.toHaveBeenCalled();
    expect(deps.loadRepositoryContext).not.toHaveBeenCalled();
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it.each([
    ["tag push", { ref: "refs/tags/v1.0.0" }],
    ["deleted branch", { deleted: true }],
    ["zero after SHA", { after: ZERO_SHA }],
  ])("ignores %s before delivery admission", async (_label, overrides) => {
    const deps = dependencies();

    await expect(processGitHubWebhook(verified("push", pushPayload(overrides)), deps))
      .resolves.toEqual({ status: "ignored", code: "PUSH_NOT_SCANNABLE" });

    expect(deps.admitDelivery).not.toHaveBeenCalled();
    expect(deps.createInstallationToken).not.toHaveBeenCalled();
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it("returns delivery replay before provider work", async () => {
    const deps = dependencies({
      admitDelivery: vi.fn(async () => ({ admitted: false, replayed: true })),
    });

    await expect(processGitHubWebhook(verified("push", pushPayload()), deps))
      .resolves.toEqual({ status: "replayed", code: "DELIVERY_REPLAY" });

    expect(deps.loadRepositoryContext).not.toHaveBeenCalled();
    expect(deps.createInstallationToken).not.toHaveBeenCalled();
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it("ignores a push for a repository that is not connected", async () => {
    const deps = dependencies({ loadRepositoryContext: vi.fn(async () => null) });

    await expect(processGitHubWebhook(verified("push", pushPayload()), deps))
      .resolves.toEqual({ status: "ignored", code: "REPOSITORY_NOT_CONNECTED" });

    expect(deps.createInstallationToken).not.toHaveBeenCalled();
    expect(deps.recordDeliveryResult).toHaveBeenCalledWith(DELIVERY_ID, "ignored", "REPOSITORY_NOT_CONNECTED");
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it.each([
    ["inactive connection", { ...context, connectionStatus: "suspended" as const }, "CONNECTION_INACTIVE"],
    ["inactive repository access", { ...context, accessStatus: "inaccessible" as const }, "REPOSITORY_INACTIVE"],
    ["disabled automatic scanning", { ...context, autoScanEnabled: false }, "AUTO_SCAN_DISABLED"],
  ])("does not queue for %s", async (_label, storedContext, code) => {
    const deps = dependencies({ loadRepositoryContext: vi.fn(async () => storedContext) });

    await expect(processGitHubWebhook(verified("push", pushPayload()), deps))
      .resolves.toEqual({ status: "ignored", code });

    expect(deps.createInstallationToken).not.toHaveBeenCalled();
    expect(deps.recordDeliveryResult).toHaveBeenCalledWith(DELIVERY_ID, "ignored", code);
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it("uses only authoritative provider identity and ignores forged payload metadata", async () => {
    const deps = dependencies();

    await expect(processGitHubWebhook(verified("push", pushPayload()), deps))
      .resolves.toEqual({
        status: "queued",
        taskId: TASK_ID,
        executionClass: "repository_snapshot_github_public_v1",
      });

    expect(deps.createInstallationToken).toHaveBeenCalledWith(
      INSTALLATION_ID,
      config,
      { repositoryId: REPOSITORY_ID },
    );
    expect(deps.reconcileRepository).toHaveBeenCalledWith({
      installationId: INSTALLATION_ID,
      repositoryId: REPOSITORY_ID,
      ownerLogin: repository.ownerLogin,
      repositoryName: repository.name,
      fullName: repository.fullName,
      defaultBranch: repository.defaultBranch,
      isPrivate: false,
      htmlUrl: repository.htmlUrl,
      providerArchived: false,
      accessStatus: "active",
    });
    expect(deps.recordPushHead).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      linkId: LINK_ID,
      repositoryId: REPOSITORY_ID,
      deliveryId: DELIVERY_ID,
      commitSha: HEAD_SHA,
    });
    expect(deps.enqueueProjectSnapshot).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      linkId: LINK_ID,
      deliveryId: DELIVERY_ID,
      commitSha: HEAD_SHA,
    });
    expect(JSON.stringify(vi.mocked(deps.reconcileRepository).mock.calls)).not.toContain("attacker/forged");
  });

  it("ignores a non-default branch after authoritative repository revalidation", async () => {
    const deps = dependencies();

    await expect(processGitHubWebhook(verified("push", pushPayload({ ref: "refs/heads/feature" })), deps))
      .resolves.toEqual({ status: "ignored", code: "NON_DEFAULT_BRANCH" });

    expect(deps.getInstallationRepository).toHaveBeenCalledTimes(1);
    expect(deps.getDefaultBranchHead).not.toHaveBeenCalled();
    expect(deps.recordPushHead).not.toHaveBeenCalled();
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it("reconciles an archived provider repository but queues nothing", async () => {
    const archivedRepository = { ...repository, isArchived: true };
    const deps = dependencies({
      getInstallationRepository: vi.fn(async () => archivedRepository),
    });

    await expect(processGitHubWebhook(verified("push", pushPayload()), deps))
      .resolves.toEqual({ status: "ignored", code: "REPOSITORY_ARCHIVED" });

    expect(deps.reconcileRepository).toHaveBeenCalledWith(expect.objectContaining({ providerArchived: true }));
    expect(deps.getDefaultBranchHead).not.toHaveBeenCalled();
    expect(deps.recordPushHead).not.toHaveBeenCalled();
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it("marks stale webhook after-SHA as superseded by the authoritative default head", async () => {
    const deps = dependencies({ getDefaultBranchHead: vi.fn(async () => HEAD_SHA) });

    await expect(processGitHubWebhook(verified("push", pushPayload({ after: STALE_SHA })), deps))
      .resolves.toEqual({ status: "superseded", code: "AUTHORITATIVE_HEAD_ADVANCED" });

    expect(deps.recordPushHead).not.toHaveBeenCalled();
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
    expect(deps.recordDeliveryResult).toHaveBeenCalledWith(DELIVERY_ID, "processed", "AUTHORITATIVE_HEAD_ADVANCED");
  });

  it("returns semantic replay without creating another snapshot chain", async () => {
    const deps = dependencies({
      recordPushHead: vi.fn(async () => ({
        replayed: true,
        shouldEnqueue: false,
        coalesced: false,
        ignored: false,
        desiredCommitSha: HEAD_SHA,
      })),
    });

    await expect(processGitHubWebhook(verified("push", pushPayload()), deps))
      .resolves.toEqual({ status: "replayed", code: "SEMANTIC_REPLAY" });

    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it("coalesces a newer head behind an existing active chain instead of enqueueing concurrently", async () => {
    const deps = dependencies({
      recordPushHead: vi.fn(async () => ({
        replayed: false,
        shouldEnqueue: false,
        coalesced: true,
        ignored: false,
        desiredCommitSha: HEAD_SHA,
      })),
    });

    await expect(processGitHubWebhook(verified("push", pushPayload()), deps))
      .resolves.toEqual({ status: "pending", code: "COALESCED" });

    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it("respects the public snapshot runtime gate independently", async () => {
    const privateGate = vi.fn(() => true);
    const deps = dependencies({
      publicSnapshotRuntimeEnabled: () => false,
      privateSnapshotRuntimeEnabled: privateGate,
    });

    await expect(processGitHubWebhook(verified("push", pushPayload()), deps))
      .resolves.toEqual({ status: "runtime_unavailable", code: "PUBLIC_SNAPSHOT_RUNTIME_UNAVAILABLE" });

    expect(privateGate).not.toHaveBeenCalled();
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it("respects the private snapshot runtime gate independently", async () => {
    const privateRepository = { ...repository, isPrivate: true };
    const publicGate = vi.fn(() => true);
    const deps = dependencies({
      getInstallationRepository: vi.fn(async () => privateRepository),
      publicSnapshotRuntimeEnabled: publicGate,
      privateSnapshotRuntimeEnabled: () => false,
    });

    await expect(processGitHubWebhook(verified("push", pushPayload()), deps))
      .resolves.toEqual({ status: "runtime_unavailable", code: "PRIVATE_SNAPSHOT_RUNTIME_UNAVAILABLE" });

    expect(publicGate).not.toHaveBeenCalled();
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it("maps an enqueue race replay to pending without creating a second chain", async () => {
    const deps = dependencies({
      enqueueProjectSnapshot: vi.fn(async () => ({
        replayed: true,
        taskId: TASK_ID,
        desiredCommitSha: HEAD_SHA,
      })),
    });

    await expect(processGitHubWebhook(verified("push", pushPayload()), deps))
      .resolves.toEqual({ status: "pending", code: "ENQUEUE_REPLAY" });

    expect(deps.enqueueProjectSnapshot).toHaveBeenCalledTimes(1);
  });
});
