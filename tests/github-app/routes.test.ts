import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  beginGitHubConnection: vi.fn(),
  prepareGitHubUserAuthorization: vi.fn(),
  completeGitHubConnection: vi.fn(),
}));

vi.mock("@/lib/github-app/authorization", async () => {
  class GitHubConnectionAuthorizationError extends Error {
    constructor(public readonly code: string, message: string) {
      super(message);
    }
  }
  return {
    GitHubConnectionAuthorizationError,
    beginGitHubConnection: mocks.beginGitHubConnection,
    prepareGitHubUserAuthorization: mocks.prepareGitHubUserAuthorization,
    completeGitHubConnection: mocks.completeGitHubConnection,
  };
});

beforeEach(() => {
  mocks.beginGitHubConnection.mockReset();
  mocks.prepareGitHubUserAuthorization.mockReset();
  mocks.completeGitHubConnection.mockReset();
  process.env.HOSTED_GITHUB_INTEGRATION_ENABLED = "true";
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

afterEach(() => {
  delete process.env.HOSTED_GITHUB_INTEGRATION_ENABLED;
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

describe("GitHub integration routes", () => {
  it("fails closed before provider work when the hosted GitHub integration is disabled", async () => {
    delete process.env.HOSTED_GITHUB_INTEGRATION_ENABLED;
    const { GET } = await import("@/app/api/integrations/github/connect/route");
    const response = await (GET as unknown as (request: NextRequest) => Promise<Response>)(
      new NextRequest("https://scopeforge-preview.example/api/integrations/github/connect"),
    );

    expect(mocks.beginGitHubConnection).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://scopeforge-preview.example/dashboard/integrations/github?error=disabled",
    );
  });

  it("keeps local error redirects on the request origin when no canonical site URL is configured", async () => {
    const { GitHubConnectionAuthorizationError } = await import("@/lib/github-app/authorization");
    mocks.beginGitHubConnection.mockRejectedValue(
      new GitHubConnectionAuthorizationError("GITHUB_CONNECTION_UNAUTHENTICATED", "Sign in."),
    );
    const { GET } = await import("@/app/api/integrations/github/connect/route");
    const response = await (GET as unknown as (request: NextRequest) => Promise<Response>)(
      new NextRequest("https://scopeforge-preview.example/api/integrations/github/connect"),
    );

    expect(response.headers.get("location")).toBe(
      "https://scopeforge-preview.example/auth/sign-in?next=%2Fdashboard%2Fintegrations%2Fgithub",
    );
    expect(response.headers.get("location")).not.toContain("localhost");
  });

  it("starts installation with a secure state cookie and fixed GitHub redirect", async () => {
    mocks.beginGitHubConnection.mockResolvedValue(
      new URL("https://github.com/apps/scopeforge-dev/installations/new?state=signed-state-value"),
    );
    const { GET } = await import("@/app/api/integrations/github/connect/route");
    const response = await (GET as unknown as (request: NextRequest) => Promise<Response>)(
      new NextRequest("https://scopeforge.dev/api/integrations/github/connect"),
    );

    expect(response.headers.get("location")).toBe(
      "https://github.com/apps/scopeforge-dev/installations/new?state=signed-state-value",
    );
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("scopeforge_github_state=signed-state-value");
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=600/i);
  });

  it("fails closed on callback before OAuth/provider work when the hosted integration is disabled", async () => {
    delete process.env.HOSTED_GITHUB_INTEGRATION_ENABLED;
    const { GET } = await import("@/app/api/integrations/github/callback/route");
    const response = await GET(new NextRequest(
      "https://scopeforge-preview.example/api/integrations/github/callback?code=oauth-code&state=signed-state-value",
      { headers: { cookie: "scopeforge_github_state=signed-state-value; scopeforge_github_installation=9001" } },
    ));

    expect(mocks.completeGitHubConnection).not.toHaveBeenCalled();
    expect(mocks.prepareGitHubUserAuthorization).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://scopeforge-preview.example/dashboard/integrations/github?error=disabled",
    );
  });

  it("turns the untrusted post-install id into a pending cookie before GitHub user OAuth", async () => {
    mocks.prepareGitHubUserAuthorization.mockResolvedValue({
      installationId: 9001,
      authorizationUrl: new URL(
        "https://github.com/login/oauth/authorize?client_id=Iv1.0123456789abcdef&state=signed-state-value",
      ),
    });
    const { GET } = await import("@/app/api/integrations/github/callback/route");
    const response = await GET(new NextRequest(
      "https://scopeforge.dev/api/integrations/github/callback?installation_id=9001&setup_action=install&state=signed-state-value",
      { headers: { cookie: "scopeforge_github_state=signed-state-value" } },
    ));

    expect(mocks.prepareGitHubUserAuthorization).toHaveBeenCalledWith({
      state: "signed-state-value",
      installationId: 9001,
    });
    expect(response.headers.get("location")).toContain("https://github.com/login/oauth/authorize?");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("scopeforge_github_installation=9001");
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it("completes OAuth only with the state and pending installation cookies, then clears both", async () => {
    mocks.completeGitHubConnection.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      workspaceId: "22222222-2222-4222-8222-222222222222",
      installationId: 9001,
    });
    const { GET } = await import("@/app/api/integrations/github/callback/route");
    const response = await GET(new NextRequest(
      "https://scopeforge.dev/api/integrations/github/callback?code=oauth-code&state=signed-state-value",
      { headers: { cookie: "scopeforge_github_state=signed-state-value; scopeforge_github_installation=9001" } },
    ));

    expect(mocks.completeGitHubConnection).toHaveBeenCalledWith({
      state: "signed-state-value",
      code: "oauth-code",
      installationId: 9001,
    });
    expect(response.headers.get("location")).toBe(
      "https://scopeforge.dev/dashboard/integrations/github?connected=1",
    );
    expect(response.headers.get("location")).not.toContain("oauth-code");
    const cookies = response.headers.get("set-cookie") ?? "";
    expect(cookies).toContain("scopeforge_github_state=");
    expect(cookies).toContain("scopeforge_github_installation=");
    expect(cookies).toMatch(/Max-Age=0/i);
  });

  it("rejects callback state that does not match the secure cookie before provider work", async () => {
    const { GET } = await import("@/app/api/integrations/github/callback/route");
    const response = await GET(new NextRequest(
      "https://scopeforge.dev/api/integrations/github/callback?code=oauth-code&state=attacker-state",
      { headers: { cookie: "scopeforge_github_state=real-state" } },
    ));

    expect(mocks.completeGitHubConnection).not.toHaveBeenCalled();
    expect(mocks.prepareGitHubUserAuthorization).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://scopeforge.dev/dashboard/integrations/github?error=state",
    );
  });

  it("returns bounded error redirects without provider detail", async () => {
    const { GitHubConnectionAuthorizationError } = await import("@/lib/github-app/authorization");
    mocks.completeGitHubConnection.mockRejectedValue(
      new GitHubConnectionAuthorizationError("GITHUB_INSTALLATION_NOT_AUTHORIZED", "provider-secret-body"),
    );
    const { GET } = await import("@/app/api/integrations/github/callback/route");
    const response = await GET(new NextRequest(
      "https://scopeforge.dev/api/integrations/github/callback?code=oauth-code&state=signed-state-value",
      { headers: { cookie: "scopeforge_github_state=signed-state-value; scopeforge_github_installation=9001" } },
    ));

    expect(response.headers.get("location")).toBe(
      "https://scopeforge.dev/dashboard/integrations/github?error=installation",
    );
    expect(response.headers.get("location")).not.toContain("provider-secret-body");
  });
});