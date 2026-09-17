import { describe, expect, it, vi } from "vitest";
import type { GitHubConnectionRecord } from "@/lib/github-app/authorization";
import {
  GitHubRepositoryServiceError,
  listConnectedRepositories,
  type GitHubRepositoryActor,
  type GitHubRepositoryAssetRecord,
  type GitHubRepositoryServiceDependencies,
} from "@/lib/github-app/repositories";
import type { GitHubAppConfig, GitHubRepositorySummary } from "@/lib/github-app/types";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

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
  id: 9001,
  ownerLogin: "scopeforge-labs",
  name: "private-app",
  fullName: "scopeforge-labs/private-app",
  defaultBranch: "main",
  isPrivate: true,
  isArchived: false,
  htmlUrl: "https://github.com/scopeforge-labs/private-app",
};

const actor: GitHubRepositoryActor = {
  userId: USER_ID,
  workspaceId: WORKSPACE_ID,
  role: "owner",
};

const connection: GitHubConnectionRecord = {
  id: "33333333-3333-4333-8333-333333333333",
  workspaceId: WORKSPACE_ID,
  installationId: 7001,
  accountId: 8001,
  accountLogin: "scopeforge-labs",
  accountType: "Organization",
  repositorySelection: "selected",
  status: "active",
  installedBy: USER_ID,
  createdAt: "2026-09-10T00:00:00.000Z",
  updatedAt: "2026-09-10T00:00:00.000Z",
};

const asset: GitHubRepositoryAssetRecord = {
  id: "44444444-4444-4444-8444-444444444444",
  workspaceId: WORKSPACE_ID,
  canonicalTarget: repository.htmlUrl,
  kind: "repository",
};

function dependencies(overrides: Partial<GitHubRepositoryServiceDependencies> = {}): GitHubRepositoryServiceDependencies {
  return {
    authorizeWorkspace: vi.fn(async () => actor),
    loadConnection: vi.fn(async () => connection),
    getConfig: () => config,
    createInstallationToken: vi.fn(async () => ({ token: "installation-secret", expiresAt: "2026-09-10T01:00:00.000Z" })),
    listInstallationRepositories: vi.fn(async () => ({ repositories: [repository], page: 1, hasNextPage: false })),
    getInstallationRepository: vi.fn(async () => repository),
    findAsset: vi.fn(async () => null),
    countAssets: vi.fn(async () => 0),
    createVerifiedAsset: vi.fn(async () => asset),
    markAssetVerified: vi.fn(async (currentAsset) => currentAsset),
    findRepositoryLinkByRepository: vi.fn(async () => null),
    findRepositoryLinkByAsset: vi.fn(async () => null),
    upsertRepositoryLink: vi.fn(async (input) => ({ id: "55555555-5555-4555-8555-555555555555", ...input, autoScanEnabled: true, accessStatus: "active", createdAt: "2026-09-10T00:00:00.000Z", updatedAt: "2026-09-10T00:00:00.000Z" })),
    writeAudit: vi.fn(async () => undefined),
    now: () => new Date("2026-09-10T00:00:00.000Z"),
    ...overrides,
  };
}

describe("connected GitHub repository discovery", () => {
  it("requires workspace owner or admin access", async () => {
    await expect(listConnectedRepositories({ workspaceId: WORKSPACE_ID, page: 1 }, dependencies({
      authorizeWorkspace: async () => ({ userId: USER_ID, workspaceId: WORKSPACE_ID, role: "member" }),
    }))).rejects.toEqual(expect.objectContaining<Partial<GitHubRepositoryServiceError>>({ code: "GITHUB_REPOSITORY_FORBIDDEN" }));
  });

  it("requires an active connection", async () => {
    await expect(listConnectedRepositories({ workspaceId: WORKSPACE_ID, page: 1 }, dependencies({
      loadConnection: async () => null,
    }))).rejects.toEqual(expect.objectContaining<Partial<GitHubRepositoryServiceError>>({ code: "GITHUB_CONNECTION_MISSING" }));
  });

  it("rejects unbounded pagination", async () => {
    await expect(listConnectedRepositories({ workspaceId: WORKSPACE_ID, page: 0 }, dependencies()))
      .rejects.toEqual(expect.objectContaining<Partial<GitHubRepositoryServiceError>>({ code: "GITHUB_REPOSITORY_INPUT_INVALID" }));
    await expect(listConnectedRepositories({ workspaceId: WORKSPACE_ID, page: 1001 }, dependencies()))
      .rejects.toEqual(expect.objectContaining<Partial<GitHubRepositoryServiceError>>({ code: "GITHUB_REPOSITORY_INPUT_INVALID" }));
  });

  it("mints an installation token server-side and returns safe repository metadata only", async () => {
    const deps = dependencies();
    const page = await listConnectedRepositories({ workspaceId: WORKSPACE_ID, page: 1 }, deps);

    expect(deps.createInstallationToken).toHaveBeenCalledWith(7001, config, {});
    expect(deps.listInstallationRepositories).toHaveBeenCalledWith("installation-secret", 1);
    expect(page).toEqual({ repositories: [repository], page: 1, hasNextPage: false });
    expect(JSON.stringify(page)).not.toContain("installation-secret");
    expect(JSON.stringify(page)).not.toContain(config.clientSecret);
    expect(JSON.stringify(page)).not.toContain(config.privateKey);
  });
});
