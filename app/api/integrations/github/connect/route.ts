import { NextResponse } from "next/server";
import {
  GitHubConnectionAuthorizationError,
  beginGitHubConnection,
} from "@/lib/github-app/authorization";

const STATE_COOKIE = "scopeforge_github_state";
const CALLBACK_COOKIE_PATH = "/api/integrations/github/callback";

function localUrl(pathname: string): URL {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
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

export async function GET() {
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
    return NextResponse.redirect(localUrl(errorPath(error)));
  }
}
