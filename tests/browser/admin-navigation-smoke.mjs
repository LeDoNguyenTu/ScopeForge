import assert from "node:assert/strict";

const base = process.env.SCOPEFORGE_BROWSER_BASE_URL || "http://127.0.0.1:3000";
for (const path of ["/admin", "/admin/phase11", "/admin/users", "/admin/workspaces", "/admin/audit"]) {
  const response = await fetch(new URL(path, base), { redirect: "manual" });
  assert.equal(response.status, 307, `${path} must redirect before page rendering`);
  assert.equal(new URL(response.headers.get("location"), base).pathname, "/auth/sign-in");
  assert.match(response.headers.get("content-security-policy") || "", /script-src[^;]*'nonce-[^']+'/);
  assert.equal(response.headers.get("x-middleware-next"), null);
  assert.doesNotMatch(await response.text(), /PLATFORM_ADMIN_UNAUTHENTICATED|PlatformAdminAuthorizationError/);
}
console.log("Unauthenticated admin navigation redirects and nonce CSP passed for five routes.");
