import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("strict CSP middleware propagation", () => {
  it("builds the CSP before Supabase session handling", () => {
    const middleware = read("middleware.ts");
    expect(middleware).toContain("createCspNonce");
    expect(middleware).toContain("buildCsp");
    expect(middleware).toContain('requestHeaders.set("x-nonce"');
    expect(middleware).toContain('requestHeaders.set("Content-Security-Policy"');
    expect(middleware).toMatch(/updateSession\(request,\s*requestHeaders\)/);
    expect(middleware).toMatch(/response\.headers\.set\(["']Content-Security-Policy["']/);
  });

  it("preserves modified request headers across Supabase cookie refresh response recreation", () => {
    const sessionMiddleware = read("lib/supabase/middleware.ts");
    expect(sessionMiddleware).toMatch(/updateSession\(request:\s*NextRequest,\s*requestHeaders:\s*Headers/);
    const preservedResponses = sessionMiddleware.match(/NextResponse\.next\(\{\s*request:\s*\{\s*headers:\s*requestHeaders\s*\}\s*\}\)/g) ?? [];
    expect(preservedResponses.length).toBeGreaterThanOrEqual(2);
  });

  it("excludes API, static resources, and prefetches from document nonce work", () => {
    const middleware = read("middleware.ts");
    expect(middleware).toMatch(/\(\?!api\|_next\/static\|_next\/image\|favicon\.ico/);
    expect(middleware).toContain('key: "next-router-prefetch"');
    expect(middleware).toContain('key: "purpose", value: "prefetch"');
  });
});
