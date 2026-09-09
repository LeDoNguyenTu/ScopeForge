import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const activeStyleFiles = [
  "components/landing/AttackSurfaceSceneV5.tsx",
  "components/landing/ScopeForgeBootScreen.tsx",
  "components/dashboard/ImmersiveDashboardExperience.tsx",
  "components/auth/TurnstileChallenge.tsx"
] as const;

describe("strict CSP compatibility architecture", () => {
  it("removes React inline style attributes from the active CSP migration surface", () => {
    for (const file of activeStyleFiles) {
      expect(read(file), file).not.toContain("style={{");
    }
  });

  it("forwards the request nonce through auth pages to the Turnstile script", () => {
    const signIn = read("app/auth/sign-in/page.tsx");
    const signUp = read("app/auth/sign-up/page.tsx");
    const authForm = read("components/AuthForm.tsx");
    const turnstile = read("components/auth/TurnstileChallenge.tsx");

    for (const page of [signIn, signUp]) {
      expect(page).toContain('from "next/headers"');
      expect(page).toContain('.get("x-nonce")');
      expect(page).toMatch(/<AuthForm[^>]+nonce=\{nonce\}/);
    }

    expect(authForm).toMatch(/<TurnstileChallenge[\s\S]*nonce=\{nonce\}/);
    expect(turnstile).toContain("nonce={nonce ?? undefined}");
  });

  it("owns the not-found rendering path without inline executable/style markup", () => {
    const path = join(process.cwd(), "app/not-found.tsx");
    expect(existsSync(path)).toBe(true);
    if (!existsSync(path)) return;
    const source = read("app/not-found.tsx");
    expect(source).not.toContain("style={{");
    expect(source).not.toMatch(/<style\b|<script\b|dangerouslySetInnerHTML/);
    expect(source).toMatch(/href=["']\/["']/);
  });

  it("keeps the released browser security-header baseline intact", () => {
    const config = read("next.config.ts");
    expect(config).toContain('{ key: "X-Content-Type-Options", value: "nosniff" }');
    expect(config).toContain('{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }');
    expect(config).toContain('{ key: "X-Frame-Options", value: "DENY" }');
    expect(config).toContain("camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    expect(config).toContain("max-age=63072000; includeSubDomains; preload");
    expect(config).toContain("poweredByHeader: false");
  });

  it("keeps CSP isolated from hosted runtime authority", () => {
    const sources = [
      "middleware.ts",
      "lib/supabase/middleware.ts",
      ...(existsSync(join(process.cwd(), "lib/security/csp.ts")) ? ["lib/security/csp.ts"] : [])
    ].map(read).join("\n");
    expect(sources).not.toMatch(/HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED|HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED|HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED|HOSTED_ACTIVE_CORS_WORKER_ENABLED/);
  });
});
