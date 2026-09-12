import { NextRequest, NextResponse } from "next/server";
import {
  GitHubConnectionAuthorizationError,
  beginGitHubConnection,
} from "@/lib/github-app/authorization";
import { serverCapabilityEnabled } from "@/lib/runtime-capabilities/server";

const STATE_COOKIE = "scopeforge_github_state";
const CALLBACK_COOKIE_PATH = "/api/integrations/github/callback";

function localUrl(pathname: string, request: NextRequest): URL {
  const base = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  return new URL(pathname, base);
}

function errorPath(error: unknown): string {
  if (error instanceof GitHubConnectionAuthorizationError) {
    if (error.code === "GITHUB_CONNECTION_UNAUTHENTICATED") {
      return "/auth/sign-in?next=%2Fdashboard%2Fintegrations%2Fgithub";
    }
    if (error.code === "GITHUB_CONNECTION_FORBIDDEN") {
      return "/dashboard/integrations/github?error=forbidden";
    }
  }
  return "/dashboard/integrations/github?error=configuration";
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!serverCapabilityEnabled("HOSTED_GITHUB_INTEGRATION_ENABLED")) {
    return NextResponse.redirect(localUrl("/dashboard/integrations/github?error=disabled", request));
  }

  try {
    const installationUrl = await beginGitHubConnection();
    const state = installationUrl.searchParams.get("state");
    if (!state) throw new Error("Missing GitHub connection state.");

    const response = NextResponse.redirect(installationUrl);
    response.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: CALLBACK_COOKIE_PATH,
      maxAge: 600,
    });
    return response;
  } catch (error) {
    return NextResponse.redirect(localUrl(errorPath(error), request));
  }
}