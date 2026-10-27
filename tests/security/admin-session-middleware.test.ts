// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const session = vi.hoisted(() => ({
  getUser: vi.fn(),
  setAll: undefined as undefined | ((cookies: Array<{
    name: string; value: string; options?: { httpOnly?: boolean; secure?: boolean; path?: string; sameSite?: "lax" };
  }>) => void),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url, _key, options) => {
    session.setAll = options.cookies.setAll;
    return { auth: { getUser: session.getUser } };
  }),
}));

import { middleware } from "@/middleware";
import { updateSession } from "@/lib/supabase/middleware";

beforeEach(() => {
  session.getUser.mockReset().mockResolvedValue({ data: { user: null }, error: null });
});

describe("admin navigation session boundary", () => {
  it.each(["/admin", "/admin/phase11", "/admin/users/example?tab=security"])(
    "redirects unauthenticated navigation to %s before forwarding to the RSC tree", async (path) => {
      const response = await middleware(new NextRequest(`https://scopeforge.dev${path}`));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://scopeforge.dev/auth/sign-in");
      expect(response.headers.get("x-middleware-next")).toBeNull();
      expect(response.headers.get("content-security-policy")).toContain("'nonce-");
      expect(session.getUser).toHaveBeenCalledOnce();
    },
  );

  it("preserves refreshed cookie values and security attributes on the redirect", async () => {
    session.getUser.mockImplementation(async () => {
      session.setAll?.([{ name: "sb-session", value: "refreshed-test-value", options: {
        httpOnly: true, secure: true, sameSite: "lax", path: "/",
      } }]);
      return { data: { user: null }, error: null };
    });
    const request = new NextRequest("https://scopeforge.dev/admin/phase11");
    const response = await updateSession(request, new Headers({ "x-nonce": "test-nonce" }));
    expect(response.status).toBe(307);
    expect(response.cookies.get("sb-session")).toMatchObject({
      value: "refreshed-test-value", httpOnly: true, secure: true, sameSite: "lax", path: "/",
    });
  });

  it.each(["GET", "HEAD"])("protects unauthenticated %s document navigation", async (method) => {
    const response = await updateSession(new NextRequest("https://scopeforge.dev/admin", { method }), new Headers());
    expect(response.status).toBe(307);
  });

  it.each(["POST", "PUT", "DELETE"])("leaves %s mutations to their throwing authorization boundary", async (method) => {
    const response = await updateSession(new NextRequest("https://scopeforge.dev/admin", { method }), new Headers());
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it.each(["member", "platform-admin"])("forwards signed-in %s to existing server role and MFA checks", async (role) => {
    session.getUser.mockResolvedValue({ data: { user: { id: "test-user", app_metadata: { role } } }, error: null });
    const response = await middleware(new NextRequest("https://scopeforge.dev/admin/phase11"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    const csp = response.headers.get("content-security-policy");
    expect(csp).toContain("'nonce-");
    expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(csp);
    expect(response.headers.get("x-middleware-request-x-nonce")).toBeTruthy();
  });

  it.each(["/administrator", "/dashboard", "/auth/sign-in"])("does not redirect unrelated path %s", async (path) => {
    const response = await updateSession(new NextRequest(`https://scopeforge.dev${path}`), new Headers());
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
