import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, createCspNonce } from "@/lib/security/csp";

const productionHosts = new Set(["scopeforge.dev", "www.scopeforge.dev", "scopeforge-delta.vercel.app", "scopeforge-itsbrian.vercel.app", "scopeforge-git-main-itsbrian.vercel.app"]);
const pages = new Set(["/", "/dashboard", "/dashboard/assets", "/dashboard/assets/new", "/dashboard/findings", "/dashboard/resources", "/resources"]);
const publicFiles = new Set(["/scopeforge-mark-v2.svg", "/command-center-cinematic.webp", "/command-center-v5-poster-mobile.webp", "/command-center-v5-poster-desktop.webp", "/resources/asset-readiness.md", "/resources/finding-review.md"]);

export async function middleware(request: NextRequest) {
  if (process.env.VERCEL_ENV === "production" || productionHosts.has(request.nextUrl.hostname)) {
    return new NextResponse("Demo is not available on production.", { status: 404 });
  }
  if (!["GET", "HEAD"].includes(request.method)) {
    return new NextResponse("This demo is read-only.", { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  const path = request.nextUrl.pathname.replace(/\/$/, "") || "/";
  const allowed = pages.has(path) || publicFiles.has(path) || path.startsWith("/_next/static/")
    || /^\/dashboard\/assets\/demo-asset-[1-8]$/.test(path)
    || /^\/dashboard\/findings\/demo-finding-([1-9]|1[0-8])$/.test(path);
  if (!allowed) return new NextResponse("Not available in this demo.", { status: 404 });
  const nonce = createCspNonce();
  const policy = buildCsp({ nonce, environment: process.env.NODE_ENV === "development" ? "development" : "production" });
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

// Includes API routes, prefetch requests and all methods. No auth or session refresh.
export const config = { matcher: ["/:path*"] };
