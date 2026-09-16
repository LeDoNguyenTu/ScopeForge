import { describe, expect, it, vi } from "vitest";

import {
  processGitHubWebhook,
  type GitHubWebhookRepositoryContext,
  type GitHubWebhookServiceDependencies,
} from "@/lib/github-app/webhook-service";
import type { GitHubAppConfig, GitHubRepositorySummary } from "@/lib/github-app/types";
import type { VerifiedGitHubWebhookRequest } from "@/lib/github-app/webhook";

const DELIVERY_ID = "11111111-1111-4111-8111-111111111111";
const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";
const CONNECTION_ID = "33333333-3333-4333-8333-333333333333";
const LINK_ID = "44444444-4444-4444-8444-444444444444";
const ASSET_ID = "55555555-5555-4555-8555-555555555555";
const INSTALLED_BY = "66666666-6666-4666-8666-666666666666";
const INSTALLATION_ID = 7001;
const REPOSITORY_ID = 9001;
const HEAD_SHA = "a".repeat(40);

const config: GitHubAppConfig = {
  appId: "12345",
  clientId: "Iv1.client123",
  clientSecret: "x".repeat(32),
  privateKey: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
  slug: "scopeforge-test",
  stateSecret: "s".repeat(32),
  webhookSecret: "w".repeat(32),
};

function repository(isPrivate: boolean): GitHubRepositorySummary {
  return {
    id: REPOSITORY_ID,
    ownerLogin: "scopeforge-labs",
    name: "secure-app",
    fullName: "scopeforge-labs/secure-app",
    defaultBranch: "main",
    isPrivate,
    isArchived: false,
    htmlUrl: "https://github.com/scopeforge-labs/secure-app",
  };
}

function context(isPrivate: boolean): GitHubWebhookRepositoryContext {
  const repo = repository(isPrivate);
  return {
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
    ownerLogin: repo.ownerLogin,
    repositoryName: repo.name,
    fullName: repo.fullName,
    defaultBranch: repo.defaultBranch,
    isPrivate,
    htmlUrl: repo.htmlUrl,
    providerArchived: false,
    desiredCommitSha: null,
    successfulCommitSha: null,
    pending: false,
  };
}

function push(): VerifiedGitHubWebhookRequest {
  return {
    deliveryId: DELIVERY_ID,
    event: "push",
    rawBody: new Uint8Array([1, 2, 3]),
    payload: {
      installation: { id: INSTALLATION_ID },
      repository: { id: REPOSITORY_ID },
      ref: "refs/heads/main",
      after: HEAD_SHA,
      deleted: false,
    },
  };
}

function dependencies(isPrivate: boolean): GitHubWebhookServiceDependencies {
  const repo = repository(isPrivate);
  return {
    getConfig: () => config,
    admitDelivery: vi.fn(async () => ({ admitted: true, replayed: false })),
    loadRepositoryContext: vi.fn(async () => context(isPrivate)),
    createInstallationToken: vi.fn(async () => ({
      token: "installation-secret",
      expiresAt: "2026-09-17T01:00:00.000Z",
    })),
    getInstallationRepository: vi.fn(async () => repo),
    getDefaultBranchHead: vi.fn(async () => HEAD_SHA),
    reconcileRepository: vi.fn(async () => ({ matched: true })),
    recordPushHead: vi.fn(async () => ({
      replayed: false,
      shouldEnqueue: true,
      coalesced: false,
      ignored: false,
      desiredCommitSha: HEAD_SHA,
    })),
    publicSnapshotRuntimeEnabled: () => isPrivate,
    privateSnapshotRuntimeEnabled: () => !isPrivate,
    enqueueProjectSnapshot: vi.fn(async () => {
      throw new Error("runtime-disabled delivery must not enqueue");
    }),
    recordDeliveryResult: vi.fn(async () => undefined),
  };
}

describe("GitHub webhook runtime-gate desired-head retention", () => {
  it.each([
    ["public", false, "PUBLIC_SNAPSHOT_RUNTIME_UNAVAILABLE"],
    ["private", true, "PRIVATE_SNAPSHOT_RUNTIME_UNAVAILABLE"],
  ] as const)(
    "persists the authoritative %s desired head before reporting runtime unavailable",
    async (_label, isPrivate, expectedCode) => {
      const deps = dependencies(isPrivate);

      await expect(processGitHubWebhook(push(), deps)).resolves.toEqual({
        status: "runtime_unavailable",
        code: expectedCode,
      });

      expect(deps.recordPushHead).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        linkId: LINK_ID,
        repositoryId: REPOSITORY_ID,
        deliveryId: DELIVERY_ID,
        commitSha: HEAD_SHA,
      });
      expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
      expect(deps.recordDeliveryResult).toHaveBeenCalledWith(
        DELIVERY_ID,
        "processed",
        expectedCode,
      );
    },
  );
});
