// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { createClient as browserClient } from "../lib/supabase/client";
import { createClient as serverClient } from "../lib/supabase/server";
import { updateSession } from "../lib/supabase/middleware";
import { createAdminClient } from "../lib/supabase/admin";

describe("read-only portfolio deployment", () => {
  afterEach(() => vi.unstubAllEnvs());
  it.each(["POST", "PUT", "PATCH", "DELETE"])("rejects %s before an action or API runs", async method => {
    const response = await middleware(new NextRequest("https://demo.vercel.app/dashboard", { method }));
    expect(response.status).toBe(405);
  });
  it.each(["/api/internal/workers/claim", "/auth/callback?code=test", "/preview/dashboard"])("cannot reach %s", async path => {
    const response = await middleware(new NextRequest(`https://demo.vercel.app${path}`));
    expect(response.status).toBe(404);
  });
  it("serves the demo without session refresh and forbids external data connections", async () => {
    const response = await middleware(new NextRequest("https://demo.vercel.app/dashboard"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("content-security-policy")).toContain("connect-src 'self';");
    expect(response.headers.has("set-cookie")).toBe(false);
  });
  it("refuses the production hostname", async () => {
    const response = await middleware(new NextRequest("https://scopeforge.dev/dashboard"));
    expect(response.status).toBe(404);
  });
  it("cannot construct database clients even with inherited credentials", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://production.example");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "example-key");
    vi.stubEnv("SUPABASE_SECRET_KEY", "example-secret");
    expect(() => browserClient()).toThrow(/Demo database access is disabled/);
    expect(() => createAdminClient()).toThrow(/Demo database access is disabled/);
    await expect(serverClient()).rejects.toThrow(/Demo database access is disabled/);
    await expect(updateSession(new NextRequest("https://demo.vercel.app"), new Headers())).rejects.toThrow(/Demo database access is disabled/);
  });
});
