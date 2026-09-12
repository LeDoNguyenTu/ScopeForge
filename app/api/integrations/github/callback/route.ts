import { NextRequest, NextResponse } from "next/server";
import {
  GitHubConnectionAuthorizationError,
  completeGitHubConnection,
  prepareGitHubUserAuthorization,
} from "@/lib/github-app/authorization";
import { serverCapabilityEnabled } from "@/lib/runtime-capabilities/server";

const STATE_COOKIE = "scopeforge_github_state";
const INSTALLATION_COOKIE = "scopeforge_github_installation";
const CALLBACK_COOKIE_PATH = "/api/integrations/github/callback";
const COOKIE_BASE = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: CALLBACK_COOKIE_PATH,
};

function appUrl(pathname: string, request: NextRequest): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const base = configured || request.nextUrl.origin;
  return new URL(pathname, base);
}

function clearGitHubCookies(response: NextResponse): void {
  for (const name of [STATE_COOKIE, INSTALLATION_COOKIE]) {
    response.cookies.set(name, "", {
      ...COOKIE_BASE,
      maxAge: 0,
      expires: new Date(0),
    });
  }
}

function terminalRedirect(request: NextRequest, pathname: string): NextResponse {
  const response = NextResponse.redirect(appUrl(pathname, request));
  clearGitHubCookies(response);
  return response;
}

function errorCode(error: unknown): string {
  if (!(error instanceof GitHubConnectionAuthorizationError)) return "failed";
  switch (error.code) {
    case "GITHUB_CONNECTION_UNAUTHENTICATED":
      return "session";
    case "GITHUB_CONNECTION_FORBIDDEN":
      return "forbidden";
    case "GITHUB_CONNECTION_STATE_INVALID":
    case "GITHUB_CONNECTION_STATE_MISMATCH":
      return "state";
    case "GITHUB_INSTALLATION_NOT_AUTHORIZED":
      return "installation";
    case "GITHUB_CONNECTION_PROVIDER_FAILED":
      return "provider";
    case "GITHUB_CONNECTION_PERSIST_FAILED":
      return "persistence";
    default:
      return "failed";
  }
}

function parseInstallationId(value: string | undefined | null): number | null {
  if (!value || !/^[1-9][0-9]{0,15}$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!serverCapabilityEnabled("HOSTED_GITHUB_INTEGRATION_ENABLED")) {
    return terminalRedirect(request, "/dashboard/integrations/github?error=disabled");
  }

  const state = request.nextUrl.searchParams.get("state");
  const stateCookie = request.cookies.get(STATE_COOKIE)?.value;

  if (!state || !stateCookie || state !== stateCookie) {
    return terminalRedirect(request, "/dashboard/integrations/github?error=state");
  }

  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError) {
    return terminalRedirect(request, "/dashboard/integrations/github?error=cancelled");
  }

  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const installationId = parseInstallationId(request.cookies.get(INSTALLATION_COOKIE)?.value);
    if (!installationId) {
      return terminalRedirect(request, "/dashboard/integrations/github?error=installation");
    }

    try {
      await completeGitHubConnection({ state, code, installationId });
      return terminalRedirect(request, "/dashboard/integrations/github?connected=1");
    } catch (error) {
      return terminalRedirect(
        request,
        `/dashboard/integrations/github?error=${encodeURIComponent(errorCode(error))}`,
      );
    }
  }

  const installationId = parseInstallationId(request.nextUrl.searchParams.get("installation_id"));
  if (!installationId) {
    return terminalRedirect(request, "/dashboard/integrations/github?error=installation");
  }

  try {
    const prepared = await prepareGitHubUserAuthorization({ state, installationId });
    const response = NextResponse.redirect(prepared.authorizationUrl);
    response.cookies.set(INSTALLATION_COOKIE, String(prepared.installationId), {
      ...COOKIE_BASE,
      maxAge: 600,
    });
    return response;
  } catch (error) {
    return terminalRedirect(
      request,
      `/dashboard/integrations/github?error=${encodeURIComponent(errorCode(error))}`,
    );
  }
}