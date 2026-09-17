import { describe, expect, it, vi } from "vitest";
import type { GitHubConnectionRecord } from "@/lib/github-app/authorization";
import {
  GitHubRepositoryServiceError,
  importGitHubRepository,
  type GitHubRepositoryActor,
  type GitHubRepositoryAssetRecord,
  type GitHubRepositoryServiceDependencies,
} from "@/lib/github-app/repositories";
import type { GitHubAppConfig, GitHubRepositorySummary } from "@/lib/github-app/types";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const ASSET_ID = "44444444-4444-4444-8444-444444444444";
const LINK_ID = "55555555-5555-4555-8555-555555555555";

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
  name: "secure-app",
  fullName: "scopeforge-labs/secure-app",
  defaultBranch: "trunk",
  isPrivate: false,
  isArchived: false,
  htmlUrl: "https://github.com/scopeforge-labs/secure-app",
};

const actor: GitHubRepositoryActor = {
  userId: USER_ID,
  workspaceId: WORKSPACE_ID,
  role: "admin",
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

function asset(input: { workspaceId?: string; canonicalTarget?: string } = {}): GitHubRepositoryAssetRecord {
  return {
    id: ASSET_ID,
    workspaceId: input.workspaceId ?? WORKSPACE_ID,
    canonicalTarget: input.canonicalTarget ?? repository.htmlUrl,
    kind: "repository",
  };
}

function dependencies(overrides: Partial<GitHubRepositoryServiceDependencies> = {}): GitHubRepositoryServiceDependencies {
  return {
    authorizeWorkspace: vi.fn(async () => actor),
    loadConnection: vi.fn(async () => connection),
    getConfig: () => config,
    createInstallationToken: vi.fn(async () => ({ token: "repo-installation-secret", expiresAt: "2026-09-10T01:00:00.000Z" })),
    listInstallationRepositories: vi.fn(async () => ({ repositories: [repository], page: 1, hasNextPage: false })),
    getInstallationRepository: vi.fn(async () => repository),
    findAsset: vi.fn(async () => null),
    countAssets: vi.fn(async () => 0),
    createVerifiedAsset: vi.fn(async (input) => asset({ workspaceId: input.workspaceId, canonicalTarget: input.canonicalTarget })),
    markAssetVerified: vi.fn(async (currentAsset) => currentAsset),
    findRepositoryLinkByRepository: vi.fn(async () => null),
    findRepositoryLinkByAsset: vi.fn(async () => null),
    upsertRepositoryLink: vi.fn(async (input) => ({ id: LINK_ID, ...input, autoScanEnabled: true, accessStatus: "active", createdAt: "2026-09-10T00:00:00.000Z", updatedAt: "2026-09-10T00:00:00.000Z" })),
    writeAudit: vi.fn(async () => undefined),
    now: () => new Date("2026-09-10T00:00:00.000Z"),
    ...overrides,
  };
}

describe("trusted GitHub repository import", () => {
  it("rejects invalid repository ids before provider or database work", async () => {
    const deps = dependencies();
    await expect(importGitHubRepository({ workspaceId: WORKSPACE_ID, repositoryId: -1 }, deps))
      .rejects.toEqual(expect.objectContaining<Partial<GitHubRepositoryServiceError>>({ code: "GITHUB_REPOSITORY_INPUT_INVALID" }));
    expect(deps.createInstallationToken).not.toHaveBeenCalled();
  });

  it("re-fetches the repository through a repository-scoped installation token before creating an asset", async () => {
    const order: string[] = [];
    const deps = dependencies({
      createInstallationToken: vi.fn(async (installationId, suppliedConfig, options) => {
        order.push("token");
        expect(installationId).toBe(7001);
        expect(suppliedConfig).toBe(config);
        expect(options).toEqual({ repositoryId: repository.id });
        return { token: "repo-installation-secret", expiresAt: "2026-09-10T01:00:00.000Z" };
      }),
      getInstallationRepository: vi.fn(async () => {
        order.push("provider:lookup");
        return repository;
      }),
      createVerifiedAsset: vi.fn(async (input) => {
        order.push("asset:create");
        expect(input).toEqual(expect.objectContaining({
          workspaceId: WORKSPACE_ID,
          canonicalTarget: repository.htmlUrl,
          name: repository.name,
          verifiedBy: USER_ID,
        }));
        return asset({ workspaceId: input.workspaceId, canonicalTarget: input.canonicalTarget });
      }),
    });

    const result = await importGitHubRepository({ workspaceId: WORKSPACE_ID, repositoryId: repository.id }, deps);
    expect(order).toEqual(["token", "provider:lookup", "asset:create"]);
    expect(result).toEqual({ assetId: ASSET_ID, linkId: LINK_ID, publicAcquisitionEligible: true });
  });

  it("reuses and verifies an exact existing repository asset in the same workspace", async () => {
    const existing = asset();
    const deps = dependencies({ findAsset: vi.fn(async () => existing) });

    const result = await importGitHubRepository({ workspaceId: WORKSPACE_ID, repositoryId: repository.id }, deps);
    expect(deps.createVerifiedAsset).not.toHaveBeenCalled();
    expect(deps.markAssetVerified).toHaveBeenCalledWith(existing, USER_ID, new Date("2026-09-10T00:00:00.000Z"));
    expect(result.assetId).toBe(ASSET_ID);
  });

  it("fails closed if a lookup returns an asset from another workspace", async () => {
    const deps = dependencies({
      findAsset: vi.fn(async () => asset({ workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })),
    });

    await expect(importGitHubRepository({ workspaceId: WORKSPACE_ID, repositoryId: repository.id }, deps))
      .rejects.toEqual(expect.objectContaining<Partial<GitHubRepositoryServiceError>>({ code: "GITHUB_REPOSITORY_SCOPE_MISMATCH" }));
    expect(deps.upsertRepositoryLink).not.toHaveBeenCalled();
  });

  it("does not mutate assets when fresh GitHub access fails", async () => {
    const deps = dependencies({ getInstallationRepository: vi.fn(async () => { throw new Error("provider body secret"); }) });
    await expect(importGitHubRepository({ workspaceId: WORKSPACE_ID, repositoryId: repository.id }, deps))
      .rejects.toEqual(expect.objectContaining<Partial<GitHubRepositoryServiceError>>({ code: "GITHUB_REPOSITORY_PROVIDER_FAILED" }));
    expect(deps.findAsset).not.toHaveBeenCalled();
    expect(deps.createVerifiedAsset).not.toHaveBeenCalled();
    expect(deps.markAssetVerified).not.toHaveBeenCalled();
  });

  it("links private repositories truthfully without claiming public hosted acquisition support", async () => {
    const privateRepository: GitHubRepositorySummary = { ...repository, isPrivate: true };
    const deps = dependencies({ getInstallationRepository: vi.fn(async () => privateRepository) });
    const result = await importGitHubRepository({ workspaceId: WORKSPACE_ID, repositoryId: repository.id }, deps);

    expect(result.publicAcquisitionEligible).toBe(false);
    expect(deps.upsertRepositoryLink).toHaveBeenCalledWith(expect.objectContaining({ isPrivate: true }));
  });

  it("is idempotent for an already-linked repository", async () => {
    const existingAsset = asset();
    const existingLink = {
      id: LINK_ID,
      workspaceId: WORKSPACE_ID,
      githubConnectionId: connection.id,
      assetId: ASSET_ID,
      repositoryId: repository.id,
      ownerLogin: repository.ownerLogin,
      repositoryName: repository.name,
      fullName: repository.fullName,
      defaultBranch: repository.defaultBranch,
      isPrivate: false,
      htmlUrl: repository.htmlUrl,
      autoScanEnabled: true,
      accessStatus: "active" as const,
      createdAt: "2026-09-10T00:00:00.000Z",
      updatedAt: "2026-09-10T00:00:00.000Z",
    };
    const deps = dependencies({
      findAsset: vi.fn(async () => existingAsset),
      findRepositoryLinkByRepository: vi.fn(async () => existingLink),
      findRepositoryLinkByAsset: vi.fn(async () => existingLink),
      upsertRepositoryLink: vi.fn(async () => existingLink),
    });

    await expect(importGitHubRepository({ workspaceId: WORKSPACE_ID, repositoryId: repository.id }, deps))
      .resolves.toEqual({ assetId: ASSET_ID, linkId: LINK_ID, publicAcquisitionEligible: true });
    expect(deps.createVerifiedAsset).not.toHaveBeenCalled();
  });
});