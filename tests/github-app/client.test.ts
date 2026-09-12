import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import * as githubClient from "@/lib/github-app/client";
import {
  createInstallationToken,
  exchangeGitHubUserCode,
  getInstallationRepository,
  listInstallationRepositories,
  listUserInstallations,
} from "@/lib/github-app/client";
import type {
  GitHubAppConfig,
  GitHubInstallationSummary,
  GitHubRepositorySummary,
} from "@/lib/github-app/types";

const reconciliationClient = githubClient as unknown as {
  getInstallationDefaultBranchHead?: (
    token: string,
    repository: GitHubRepositorySummary,
    fetchImpl?: typeof fetch,
  ) => Promise<string>;
  getAppInstallation?: (
    installationId: number,
    config: GitHubAppConfig,
    fetchImpl?: typeof fetch,
  ) => Promise<GitHubInstallationSummary>;
};

function config(): GitHubAppConfig {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    appId: "123456",
    clientId: "Iv1.0123456789abcdef",
    clientSecret: "client-secret-value-0123456789",
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    slug: "scopeforge-dev",
    stateSecret: "0123456789abcdef0123456789abcdef",
    webhookSecret: "webhook-secret-0123456789abcdef0123456789",
  };
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function repositorySummary(overrides: Partial<GitHubRepositorySummary> = {}): GitHubRepositorySummary {
  return {
    id: 99,
    ownerLogin: "example-org",
    name: "repo",
    fullName: "example-org/repo",
    defaultBranch: "trunk",
    isPrivate: false,
    isArchived: false,
    htmlUrl: "https://github.com/example-org/repo",
    ...overrides,
  } as GitHubRepositorySummary;
}

describe("GitHub provider client", () => {
  it("exchanges an OAuth code only at GitHub's fixed endpoint", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://github.com/login/oauth/access_token");
      expect(init?.method).toBe("POST");
      expect(String(init?.body)).toContain("client_id=Iv1.0123456789abcdef");
      expect(String(init?.body)).toContain("code=temporary-code");
      expect(init?.signal).toBeDefined();
      return jsonResponse({ access_token: "ghu_ephemeral", token_type: "bearer", scope: "" });
    });

    await expect(exchangeGitHubUserCode("temporary-code", config(), fetchImpl)).resolves.toEqual({
      accessToken: "ghu_ephemeral",
      tokenType: "bearer",
    });
  });

  it("lists the authenticated GitHub user's installations using only the temporary user token", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://api.github.com/user/installations?per_page=100&page=1");
      expect(init?.headers).toMatchObject({ Authorization: "Bearer ghu_ephemeral" });
      return jsonResponse({ installations: [{
        id: 42,
        account: { id: 7, login: "example-org", type: "Organization" },
        repository_selection: "selected",
      }] });
    });

    await expect(listUserInstallations({ accessToken: "ghu_ephemeral", tokenType: "bearer" }, fetchImpl)).resolves.toEqual([{
      id: 42,
      accountId: 7,
      accountLogin: "example-org",
      accountType: "Organization",
      repositorySelection: "selected",
    }]);
  });

  it("mints a repository-restricted read-only installation token", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://api.github.com/app/installations/42/access_tokens");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({ Authorization: expect.stringMatching(/^Bearer [^.]+\.[^.]+\.[^.]+$/) });
      expect(JSON.parse(String(init?.body))).toEqual({
        repository_ids: [99],
        permissions: { contents: "read", metadata: "read" },
      });
      return jsonResponse({ token: "ghs_ephemeral", expires_at: "2026-09-10T08:00:00Z" });
    });

    await expect(createInstallationToken(42, config(), { repositoryId: 99 }, fetchImpl)).resolves.toEqual({
      token: "ghs_ephemeral",
      expiresAt: "2026-09-10T08:00:00Z",
    });
  });

  it("bounds repository pagination to 100 entries and normalizes archived state", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("https://api.github.com/installation/repositories?per_page=100&page=2");
      return jsonResponse({
        total_count: 1,
        repositories: [{
          id: 99,
          name: "repo",
          full_name: "example-org/repo",
          private: false,
          archived: false,
          html_url: "https://github.com/example-org/repo",
          default_branch: "main",
          owner: { login: "example-org" },
        }],
      });
    });

    await expect(listInstallationRepositories("ghs_ephemeral", 2, fetchImpl)).resolves.toEqual({
      repositories: [{
        id: 99,
        ownerLogin: "example-org",
        name: "repo",
        fullName: "example-org/repo",
        defaultBranch: "main",
        isPrivate: false,
        isArchived: false,
        htmlUrl: "https://github.com/example-org/repo",
      }],
      page: 2,
      hasNextPage: false,
    });
  });

  it("re-fetches one repository by immutable GitHub repository id with authoritative archived state", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("https://api.github.com/repositories/99");
      return jsonResponse({
        id: 99,
        name: "repo",
        full_name: "example-org/repo",
        private: true,
        archived: true,
        html_url: "https://github.com/example-org/repo",
        default_branch: "trunk",
        owner: { login: "example-org" },
      });
    });

    await expect(getInstallationRepository("ghs_ephemeral", 99, fetchImpl)).resolves.toMatchObject({
      id: 99,
      defaultBranch: "trunk",
      isPrivate: true,
      isArchived: true,
    });
  });

  it.each([undefined, "false", 0])("fails closed when provider archived state is not boolean: %p", async (archived) => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      id: 99,
      name: "repo",
      full_name: "example-org/repo",
      private: false,
      ...(archived === undefined ? {} : { archived }),
      html_url: "https://github.com/example-org/repo",
      default_branch: "main",
      owner: { login: "example-org" },
    }));

    await expect(getInstallationRepository("ghs_ephemeral", 99, fetchImpl))
      .rejects.toThrow("GitHub provider request failed.");
  });

  it("resolves only the authoritative default-branch head through the fixed commits endpoint", async () => {
    const resolveHead = reconciliationClient.getInstallationDefaultBranchHead;
    expect(typeof resolveHead).toBe("function");
    if (!resolveHead) return;

    const repository = repositorySummary();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://api.github.com/repos/example-org/repo/commits/trunk");
      expect(init?.method).toBe("GET");
      expect(init?.headers).toMatchObject({ Authorization: "Bearer ghs_ephemeral" });
      return jsonResponse({ sha: "a".repeat(40) });
    });

    await expect(resolveHead("ghs_ephemeral", repository, fetchImpl)).resolves.toBe("a".repeat(40));
  });

  it("rejects a malformed authoritative default-branch SHA", async () => {
    const resolveHead = reconciliationClient.getInstallationDefaultBranchHead;
    expect(typeof resolveHead).toBe("function");
    if (!resolveHead) return;

    await expect(resolveHead(
      "ghs_ephemeral",
      repositorySummary(),
      vi.fn(async () => jsonResponse({ sha: "not-a-commit" })),
    )).rejects.toThrow("GitHub provider request failed.");
  });

  it("reads App installation metadata through the exact installation endpoint", async () => {
    const getInstallation = reconciliationClient.getAppInstallation;
    expect(typeof getInstallation).toBe("function");
    if (!getInstallation) return;

    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://api.github.com/app/installations/42");
      expect(init?.method).toBe("GET");
      expect(init?.headers).toMatchObject({
        Authorization: expect.stringMatching(/^Bearer [^.]+\.[^.]+\.[^.]+$/),
      });
      return jsonResponse({
        id: 42,
        account: { id: 7, login: "example-org", type: "Organization" },
        repository_selection: "selected",
      });
    });

    await expect(getInstallation(42, config(), fetchImpl)).resolves.toEqual({
      id: 42,
      accountId: 7,
      accountLogin: "example-org",
      accountType: "Organization",
      repositorySelection: "selected",
    });
  });

  it.each([
    { id: 42, account: { id: 0, login: "example-org", type: "Organization" }, repository_selection: "selected" },
    { id: 42, account: { id: 7, login: "example-org", type: "Bot" }, repository_selection: "selected" },
    { id: 42, account: { id: 7, login: "example-org", type: "Organization" }, repository_selection: "unknown" },
  ])("fails closed on malformed App installation metadata", async (payload) => {
    const getInstallation = reconciliationClient.getAppInstallation;
    expect(typeof getInstallation).toBe("function");
    if (!getInstallation) return;

    await expect(getInstallation(42, config(), vi.fn(async () => jsonResponse(payload))))
      .rejects.toThrow("GitHub provider request failed.");
  });

  it("never exposes GitHub provider error bodies", async () => {
    const fetchImpl = vi.fn(async () => new Response("provider-secret-body", { status: 401 }));
    await expect(listInstallationRepositories("ghs_ephemeral", 1, fetchImpl)).rejects.toThrow("GitHub provider request failed.");
    await expect(listInstallationRepositories("ghs_ephemeral", 1, fetchImpl)).rejects.not.toThrow("provider-secret-body");
  });
});
