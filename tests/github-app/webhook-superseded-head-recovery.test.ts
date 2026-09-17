import { expect, it, vi } from "vitest";
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
const AUTHORITATIVE_HEAD = "a".repeat(40);
const STALE_PAYLOAD_HEAD = "b".repeat(40);

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

it("uses a superseded default-branch delivery as a trigger for the provider-authoritative current head", async () => {
  const recordPushHead = vi.fn(async () => ({
    replayed: false,
    shouldEnqueue: true,
    coalesced: false,
    ignored: false,
    desiredCommitSha: AUTHORITATIVE_HEAD,
  }));
  const enqueueProjectSnapshot = vi.fn(async () => ({
    replayed: false,
    taskId: TASK_ID,
    scanJobId: SCAN_JOB_ID,
    executionClass: "repository_snapshot_github_public_v1" as const,
    desiredCommitSha: AUTHORITATIVE_HEAD,
  }));

  const deps: GitHubWebhookServiceDependencies = {
    getConfig: () => config,
    admitDelivery: vi.fn(async () => ({ admitted: true, replayed: false })),
    loadRepositoryContext: vi.fn(async () => context),
    createInstallationToken: vi.fn(async () => ({
      token: "installation-secret",
      expiresAt: "2026-09-12T01:00:00.000Z",
    })),
    getInstallationRepository: vi.fn(async () => repository),
    getDefaultBranchHead: vi.fn(async () => AUTHORITATIVE_HEAD),
    reconcileRepository: vi.fn(async () => ({ matched: true })),
    recordPushHead,
    publicSnapshotRuntimeEnabled: () => true,
    privateSnapshotRuntimeEnabled: () => true,
    enqueueProjectSnapshot,
    recordDeliveryResult: vi.fn(async () => undefined),
  };

  const request: VerifiedGitHubWebhookRequest = {
    deliveryId: DELIVERY_ID,
    event: "push",
    rawBody: new Uint8Array([1, 2, 3]),
    payload: {
      installation: { id: INSTALLATION_ID },
      repository: { id: REPOSITORY_ID },
      ref: "refs/heads/main",
      after: STALE_PAYLOAD_HEAD,
      deleted: false,
    },
  };

  await expect(processGitHubWebhook(request, deps)).resolves.toEqual({
    status: "queued",
    taskId: TASK_ID,
    executionClass: "repository_snapshot_github_public_v1",
  });

  expect(recordPushHead).toHaveBeenCalledWith({
    workspaceId: WORKSPACE_ID,
    linkId: LINK_ID,
    repositoryId: REPOSITORY_ID,
    deliveryId: DELIVERY_ID,
    commitSha: AUTHORITATIVE_HEAD,
  });
  expect(enqueueProjectSnapshot).toHaveBeenCalledWith({
    workspaceId: WORKSPACE_ID,
    linkId: LINK_ID,
    deliveryId: DELIVERY_ID,
    commitSha: AUTHORITATIVE_HEAD,
  });
  expect(JSON.stringify(recordPushHead.mock.calls)).not.toContain(STALE_PAYLOAD_HEAD);
  expect(JSON.stringify(enqueueProjectSnapshot.mock.calls)).not.toContain(STALE_PAYLOAD_HEAD);
});
