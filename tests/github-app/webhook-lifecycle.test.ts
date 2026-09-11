import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  processGitHubWebhook,
  type GitHubWebhookRepositoryContext,
  type GitHubWebhookServiceDependencies,
} from "@/lib/github-app/webhook-service";
import type {
  GitHubAppConfig,
  GitHubInstallationSummary,
  GitHubRepositorySummary,
} from "@/lib/github-app/types";
import type { VerifiedGitHubWebhookRequest } from "@/lib/github-app/webhook";

const DELIVERY_ID = "11111111-1111-4111-8111-111111111111";
const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";
const CONNECTION_ID = "33333333-3333-4333-8333-333333333333";
const LINK_ID = "44444444-4444-4444-8444-444444444444";
const ASSET_ID = "55555555-5555-4555-8555-555555555555";
const INSTALLED_BY = "66666666-6666-4666-8666-666666666666";
const INSTALLATION_ID = 7001;
const REPOSITORY_ID = 9001;

const config: GitHubAppConfig = {
  appId: "12345",
  clientId: "Iv1.client123",
  clientSecret: "x".repeat(32),
  privateKey: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
  slug: "scopeforge-test",
  stateSecret: "s".repeat(32),
  webhookSecret: "w".repeat(32),
};

const installation: GitHubInstallationSummary = {
  id: INSTALLATION_ID,
  accountId: 42,
  accountLogin: "scopeforge-labs",
  accountType: "Organization",
  repositorySelection: "selected",
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

type LifecycleDependencies = GitHubWebhookServiceDependencies & {
  getAppInstallation(installationId: number, config: GitHubAppConfig): Promise<GitHubInstallationSummary>;
  reconcileConnection(input: {
    installationId: number;
    status: "active" | "suspended" | "removed";
    accountId: number | null;
    accountLogin: string | null;
    accountType: "User" | "Organization" | null;
    repositorySelection: "all" | "selected" | null;
  }): Promise<{ matched: boolean }>;
};

function verified(event: string, payload: Record<string, unknown>): VerifiedGitHubWebhookRequest {
  return {
    deliveryId: DELIVERY_ID,
    event,
    rawBody: new Uint8Array([1, 2, 3]),
    payload,
  };
}

function lifecycleDependencies(
  overrides: Partial<LifecycleDependencies> = {},
): LifecycleDependencies {
  const base: GitHubWebhookServiceDependencies = {
    getConfig: () => config,
    admitDelivery: vi.fn(async () => ({ admitted: true, replayed: false })),
    loadRepositoryContext: vi.fn(async () => context),
    createInstallationToken: vi.fn(async () => ({
      token: "installation-secret",
      expiresAt: "2026-09-12T01:00:00.000Z",
    })),
    getInstallationRepository: vi.fn(async () => repository),
    getDefaultBranchHead: vi.fn(async () => "a".repeat(40)),
    reconcileRepository: vi.fn(async () => ({ matched: true })),
    recordPushHead: vi.fn(async () => ({
      replayed: false,
      shouldEnqueue: false,
      coalesced: false,
      ignored: true,
      desiredCommitSha: "a".repeat(40),
    })),
    publicSnapshotRuntimeEnabled: () => true,
    privateSnapshotRuntimeEnabled: () => true,
    enqueueProjectSnapshot: vi.fn(async () => ({
      replayed: true,
      desiredCommitSha: "a".repeat(40),
    })),
    recordDeliveryResult: vi.fn(async () => undefined),
  };

  return Object.assign(base, {
    getAppInstallation: vi.fn(async () => installation),
    reconcileConnection: vi.fn(async () => ({ matched: true })),
  }, overrides) as LifecycleDependencies;
}

function installationPayload(action: string): Record<string, unknown> {
  return {
    action,
    installation: {
      id: INSTALLATION_ID,
      account: { id: 999999, login: "attacker-forged", type: "User" },
      repository_selection: "all",
    },
  };
}

function repositoryPayload(action: string): Record<string, unknown> {
  return {
    action,
    installation: { id: INSTALLATION_ID },
    repository: {
      id: REPOSITORY_ID,
      owner: { login: "attacker" },
      name: "forged",
      full_name: "attacker/forged",
      default_branch: "forged",
      private: true,
      archived: true,
      html_url: "https://github.com/attacker/forged",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GitHub webhook lifecycle reconciliation", () => {
  it.each([
    ["suspended", "suspended", "INSTALLATION_SUSPENDED"],
    ["deleted", "removed", "INSTALLATION_REMOVED"],
  ] as const)("handles installation %s without trusting payload metadata or starting scans", async (action, status, code) => {
    const deps = lifecycleDependencies();

    await expect(processGitHubWebhook(verified("installation", installationPayload(action)), deps))
      .resolves.toEqual({ status: "accepted", code });

    expect(deps.admitDelivery).toHaveBeenCalledWith(expect.objectContaining({
      deliveryId: DELIVERY_ID,
      eventName: "installation",
      action,
      installationId: INSTALLATION_ID,
      repositoryId: null,
    }));
    expect(deps.getAppInstallation).not.toHaveBeenCalled();
    expect(deps.reconcileConnection).toHaveBeenCalledWith({
      installationId: INSTALLATION_ID,
      status,
      accountId: null,
      accountLogin: null,
      accountType: null,
      repositorySelection: null,
    });
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(deps.reconcileConnection).mock.calls)).not.toContain("attacker-forged");
  });

  it("requires authoritative provider revalidation before unsuspending an installation", async () => {
    const deps = lifecycleDependencies();

    await expect(processGitHubWebhook(verified("installation", installationPayload("unsuspended")), deps))
      .resolves.toEqual({ status: "accepted", code: "INSTALLATION_ACTIVE" });

    expect(deps.getAppInstallation).toHaveBeenCalledWith(INSTALLATION_ID, config);
    expect(deps.reconcileConnection).toHaveBeenCalledWith({
      installationId: INSTALLATION_ID,
      status: "active",
      accountId: installation.accountId,
      accountLogin: installation.accountLogin,
      accountType: installation.accountType,
      repositorySelection: installation.repositorySelection,
    });
    expect(JSON.stringify(vi.mocked(deps.reconcileConnection).mock.calls)).not.toContain("attacker-forged");
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it("marks removed installation repositories inaccessible from stored identity without provider reactivation", async () => {
    const deps = lifecycleDependencies();
    const payload = {
      action: "removed",
      installation: { id: INSTALLATION_ID },
      repositories_removed: [{ id: REPOSITORY_ID, full_name: "attacker/forged" }],
      repositories_added: [],
    };

    await expect(processGitHubWebhook(verified("installation_repositories", payload), deps))
      .resolves.toEqual({ status: "accepted", code: "REPOSITORIES_RECONCILED" });

    expect(deps.loadRepositoryContext).toHaveBeenCalledWith(INSTALLATION_ID, REPOSITORY_ID);
    expect(deps.createInstallationToken).not.toHaveBeenCalled();
    expect(deps.reconcileRepository).toHaveBeenCalledWith({
      installationId: INSTALLATION_ID,
      repositoryId: REPOSITORY_ID,
      ownerLogin: context.ownerLogin,
      repositoryName: context.repositoryName,
      fullName: context.fullName,
      defaultBranch: context.defaultBranch,
      isPrivate: context.isPrivate,
      htmlUrl: context.htmlUrl,
      providerArchived: context.providerArchived,
      accessStatus: "inaccessible",
    });
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it("never auto-imports newly added installation repositories", async () => {
    const deps = lifecycleDependencies({
      loadRepositoryContext: vi.fn(async () => null),
    });
    const payload = {
      action: "added",
      installation: { id: INSTALLATION_ID },
      repositories_added: [{ id: REPOSITORY_ID, full_name: repository.fullName }],
      repositories_removed: [],
    };

    await expect(processGitHubWebhook(verified("installation_repositories", payload), deps))
      .resolves.toEqual({ status: "accepted", code: "REPOSITORIES_RECONCILED" });

    expect(deps.loadRepositoryContext).toHaveBeenCalledWith(INSTALLATION_ID, REPOSITORY_ID);
    expect(deps.createInstallationToken).not.toHaveBeenCalled();
    expect(deps.reconcileRepository).not.toHaveBeenCalled();
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it("reactivates an already-connected added repository only after repository-scoped provider revalidation", async () => {
    const deps = lifecycleDependencies();
    const payload = {
      action: "added",
      installation: { id: INSTALLATION_ID },
      repositories_added: [{ id: REPOSITORY_ID, full_name: "attacker/forged" }],
      repositories_removed: [],
    };

    await expect(processGitHubWebhook(verified("installation_repositories", payload), deps))
      .resolves.toEqual({ status: "accepted", code: "REPOSITORIES_RECONCILED" });

    expect(deps.createInstallationToken).toHaveBeenCalledWith(
      INSTALLATION_ID,
      config,
      { repositoryId: REPOSITORY_ID },
    );
    expect(deps.getInstallationRepository).toHaveBeenCalledWith("installation-secret", REPOSITORY_ID);
    expect(deps.reconcileRepository).toHaveBeenCalledWith({
      installationId: INSTALLATION_ID,
      repositoryId: REPOSITORY_ID,
      ownerLogin: repository.ownerLogin,
      repositoryName: repository.name,
      fullName: repository.fullName,
      defaultBranch: repository.defaultBranch,
      isPrivate: repository.isPrivate,
      htmlUrl: repository.htmlUrl,
      providerArchived: repository.isArchived,
      accessStatus: "active",
    });
    expect(JSON.stringify(vi.mocked(deps.reconcileRepository).mock.calls)).not.toContain("attacker/forged");
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it.each(["renamed", "transferred", "privatized", "publicized", "archived", "unarchived"])(
    "re-fetches authoritative repository state for repository %s without mutating the queued task class",
    async (action) => {
      const providerRepository = {
        ...repository,
        isPrivate: action === "privatized",
        isArchived: action === "archived",
        ...(action === "renamed" || action === "transferred"
          ? {
              ownerLogin: "scopeforge-security",
              name: "renamed-app",
              fullName: "scopeforge-security/renamed-app",
              htmlUrl: "https://github.com/scopeforge-security/renamed-app",
            }
          : {}),
      };
      const deps = lifecycleDependencies({
        getInstallationRepository: vi.fn(async () => providerRepository),
      });

      await expect(processGitHubWebhook(verified("repository", repositoryPayload(action)), deps))
        .resolves.toEqual({ status: "accepted", code: "REPOSITORY_RECONCILED" });

      expect(deps.loadRepositoryContext).toHaveBeenCalledWith(INSTALLATION_ID, REPOSITORY_ID);
      expect(deps.getInstallationRepository).toHaveBeenCalledWith("installation-secret", REPOSITORY_ID);
      expect(deps.reconcileRepository).toHaveBeenCalledWith({
        installationId: INSTALLATION_ID,
        repositoryId: REPOSITORY_ID,
        ownerLogin: providerRepository.ownerLogin,
        repositoryName: providerRepository.name,
        fullName: providerRepository.fullName,
        defaultBranch: providerRepository.defaultBranch,
        isPrivate: providerRepository.isPrivate,
        htmlUrl: providerRepository.htmlUrl,
        providerArchived: providerRepository.isArchived,
        accessStatus: "active",
      });
      expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
      expect(deps.recordPushHead).not.toHaveBeenCalled();
      expect(JSON.stringify(vi.mocked(deps.reconcileRepository).mock.calls)).not.toContain("https://github.com/attacker/forged");
    },
  );

  it("retains stored repository identity while marking a deleted repository removed", async () => {
    const deps = lifecycleDependencies();

    await expect(processGitHubWebhook(verified("repository", repositoryPayload("deleted")), deps))
      .resolves.toEqual({ status: "accepted", code: "REPOSITORY_REMOVED" });

    expect(deps.loadRepositoryContext).toHaveBeenCalledWith(INSTALLATION_ID, REPOSITORY_ID);
    expect(deps.createInstallationToken).not.toHaveBeenCalled();
    expect(deps.reconcileRepository).toHaveBeenCalledWith({
      installationId: INSTALLATION_ID,
      repositoryId: REPOSITORY_ID,
      ownerLogin: context.ownerLogin,
      repositoryName: context.repositoryName,
      fullName: context.fullName,
      defaultBranch: context.defaultBranch,
      isPrivate: context.isPrivate,
      htmlUrl: context.htmlUrl,
      providerArchived: context.providerArchived,
      accessStatus: "removed",
    });
    expect(deps.enqueueProjectSnapshot).not.toHaveBeenCalled();
  });

  it("ignores unknown lifecycle actions before delivery persistence or provider work", async () => {
    const deps = lifecycleDependencies();

    await expect(processGitHubWebhook(verified("repository", repositoryPayload("starred")), deps))
      .resolves.toEqual({ status: "ignored", code: "ACTION_UNSUPPORTED" });

    expect(deps.admitDelivery).not.toHaveBeenCalled();
    expect(deps.loadRepositoryContext).not.toHaveBeenCalled();
    expect(deps.createInstallationToken).not.toHaveBeenCalled();
    expect(deps.reconcileRepository).not.toHaveBeenCalled();
  });

  it("stops an exact lifecycle delivery replay before any provider reconciliation", async () => {
    const deps = lifecycleDependencies({
      admitDelivery: vi.fn(async () => ({ admitted: false, replayed: true })),
    });

    await expect(processGitHubWebhook(verified("repository", repositoryPayload("renamed")), deps))
      .resolves.toEqual({ status: "replayed", code: "DELIVERY_REPLAY" });

    expect(deps.loadRepositoryContext).not.toHaveBeenCalled();
    expect(deps.createInstallationToken).not.toHaveBeenCalled();
    expect(deps.reconcileRepository).not.toHaveBeenCalled();
  });
});
