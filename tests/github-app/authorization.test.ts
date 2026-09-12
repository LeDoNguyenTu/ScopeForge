import { describe, expect, it, vi } from "vitest";
import { createGitHubConnectionState } from "@/lib/github-app/state";
import type { GitHubAppConfig, GitHubInstallationSummary, GitHubUserToken } from "@/lib/github-app/types";
import {
  GitHubConnectionAuthorizationError,
  beginGitHubConnection,
  completeGitHubConnection,
  prepareGitHubUserAuthorization,
  type GitHubConnectionAuthorizationDependencies,
} from "@/lib/github-app/authorization";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";
const STATE_SECRET = "0123456789abcdef0123456789abcdef";
const NOW = new Date("2026-09-10T15:30:00.000Z");
const CONFIG: GitHubAppConfig = {
  appId: "123456",
  clientId: "Iv1.0123456789abcdef",
  clientSecret: "client-secret-value-0123456789",
  privateKey: "-----BEGIN PRIVATE KEY-----\ntest-only-not-used-in-these-tests\n-----END PRIVATE KEY-----",
  slug: "scopeforge-dev",
  stateSecret: STATE_SECRET,
};

function installation(id = 9001): GitHubInstallationSummary {
  return {
    id,
    accountId: 7001,
    accountLogin: "scopeforge-test",
    accountType: "Organization",
    repositorySelection: "selected",
  };
}

function dependencies(
  overrides: Partial<GitHubConnectionAuthorizationDependencies> = {},
): GitHubConnectionAuthorizationDependencies {
  return {
    getConfig: () => CONFIG,
    authorizeWorkspace: async (workspaceId) => ({
      userId: USER_ID,
      workspaceId: workspaceId ?? WORKSPACE_ID,
      role: "owner",
    }),
    createNonce: () => "0123456789abcdef0123456789abcdef",
    now: () => NOW,
    exchangeUserCode: async () => ({ accessToken: "ghu_ephemeral_user_token", tokenType: "bearer" }),
    listUserInstallations: async () => [installation()],
    upsertConnection: async (input) => ({
      id: "33333333-3333-4333-8333-333333333333",
      ...input,
      status: "active",
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    }),
    ...overrides,
  };
}

function signedState(userId = USER_ID, workspaceId = WORKSPACE_ID): string {
  return createGitHubConnectionState(
    { userId, workspaceId, nonce: "0123456789abcdef" },
    STATE_SECRET,
    NOW,
  );
}

describe("GitHub installation authorization", () => {
  it.each(["owner", "admin"] as const)("allows workspace %s to begin installation", async (role) => {
    const url = await beginGitHubConnection(dependencies({
      authorizeWorkspace: async () => ({ userId: USER_ID, workspaceId: WORKSPACE_ID, role }),
    }));
    expect(url.origin).toBe("https://github.com");
    expect(url.pathname).toBe("/apps/scopeforge-dev/installations/new");
    expect(url.searchParams.get("state")).toBeTruthy();
  });

  it("rejects a workspace member before redirecting to GitHub", async () => {
    await expect(beginGitHubConnection(dependencies({
      authorizeWorkspace: async () => ({ userId: USER_ID, workspaceId: WORKSPACE_ID, role: "member" }),
    }))).rejects.toEqual(expect.objectContaining<Partial<GitHubConnectionAuthorizationError>>({
      code: "GITHUB_CONNECTION_FORBIDDEN",
    }));
  });

  it("re-authorizes the signed ScopeForge user and workspace before OAuth", async () => {
    const authorizeWorkspace = vi.fn(async (workspaceId?: string) => ({
      userId: USER_ID,
      workspaceId: workspaceId ?? WORKSPACE_ID,
      role: "admin" as const,
    }));
    const result = await prepareGitHubUserAuthorization(
      { state: signedState(), installationId: 9001 },
      dependencies({ authorizeWorkspace }),
    );
    expect(authorizeWorkspace).toHaveBeenCalledWith(WORKSPACE_ID);
    expect(result.authorizationUrl.origin).toBe("https://github.com");
    expect(result.authorizationUrl.pathname).toBe("/login/oauth/authorize");
    expect(result.authorizationUrl.searchParams.get("client_id")).toBe(CONFIG.clientId);
    expect(result.authorizationUrl.searchParams.get("state")).toBe(signedState());
    expect(result.installationId).toBe(9001);
  });

  it("rejects a signed state bound to a different ScopeForge user before provider exchange", async () => {
    const exchangeUserCode = vi.fn<() => Promise<GitHubUserToken>>();
    await expect(completeGitHubConnection(
      { state: signedState("44444444-4444-4444-8444-444444444444"), code: "oauth-code", installationId: 9001 },
      dependencies({ exchangeUserCode }),
    )).rejects.toEqual(expect.objectContaining({ code: "GITHUB_CONNECTION_STATE_MISMATCH" }));
    expect(exchangeUserCode).not.toHaveBeenCalled();
  });

  it("rejects a spoofed installation id even when its format is valid", async () => {
    const upsertConnection = vi.fn();
    await expect(completeGitHubConnection(
      { state: signedState(), code: "oauth-code", installationId: 9999 },
      dependencies({
        listUserInstallations: async () => [installation(9001)],
        upsertConnection,
      }),
    )).rejects.toEqual(expect.objectContaining<Partial<GitHubConnectionAuthorizationError>>({
      code: "GITHUB_INSTALLATION_NOT_AUTHORIZED",
    }));
    expect(upsertConnection).not.toHaveBeenCalled();
  });

  it("persists only safe installation metadata after authenticated ownership proof", async () => {
    const persisted: Array<Record<string, unknown>> = [];
    const result = await completeGitHubConnection(
      { state: signedState(), code: "oauth-code", installationId: 9001 },
      dependencies({
        upsertConnection: async (input) => {
          persisted.push(input as unknown as Record<string, unknown>);
          return {
            id: "33333333-3333-4333-8333-333333333333",
            ...input,
            status: "active",
            createdAt: NOW.toISOString(),
            updatedAt: NOW.toISOString(),
          };
        },
      }),
    );

    expect(result.installationId).toBe(9001);
    expect(persisted).toHaveLength(1);
    expect(Object.keys(persisted[0])).toEqual(expect.arrayContaining([
      "workspaceId", "installationId", "accountId", "accountLogin", "accountType", "repositorySelection", "installedBy",
    ]));
    expect(JSON.stringify(persisted[0])).not.toContain("ghu_ephemeral_user_token");
    expect(JSON.stringify(result)).not.toContain("ghu_ephemeral_user_token");
  });
});
