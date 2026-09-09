import { describe, expect, it } from "vitest";
import {
  buildCsp,
  createCspNonce,
  normalizeBrowserOrigin,
} from "@/lib/security/csp";

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

describe("strict CSP policy contract", () => {
  it("generates independent 128-bit hex nonces", () => {
    const first = createCspNonce();
    const second = createCspNonce();

    expect(first).toMatch(/^[a-f0-9]{32}$/);
    expect(second).toMatch(/^[a-f0-9]{32}$/);
    expect(second).not.toBe(first);
  });

  it("normalizes only browser-safe configured origins", () => {
    expect(normalizeBrowserOrigin("https://project.supabase.co", "production"))
      .toBe("https://project.supabase.co");
    expect(normalizeBrowserOrigin("https://project.supabase.co/", "production"))
      .toBe("https://project.supabase.co");
    expect(normalizeBrowserOrigin("http://localhost:54321", "development"))
      .toBe("http://localhost:54321");

    expect(normalizeBrowserOrigin("http://project.supabase.co", "production")).toBeNull();
    expect(normalizeBrowserOrigin("https://user:pass@project.supabase.co", "production")).toBeNull();
    expect(normalizeBrowserOrigin("https://project.supabase.co/path", "production")).toBeNull();
    expect(normalizeBrowserOrigin("https://project.supabase.co?x=1", "production")).toBeNull();
    expect(normalizeBrowserOrigin("javascript:alert(1)", "production")).toBeNull();
    expect(normalizeBrowserOrigin("not a url", "production")).toBeNull();
  });

  it("builds a strict production policy for the exact configured Supabase origin", () => {
    const policy = buildCsp({
      nonce: "0123456789abcdef0123456789abcdef",
      environment: "production",
      supabaseUrl: "https://project.supabase.co",
    });

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("script-src 'self' 'nonce-0123456789abcdef0123456789abcdef' 'strict-dynamic'");
    expect(policy).toContain("style-src 'self' 'nonce-0123456789abcdef0123456789abcdef'");
    expect(policy).toContain("img-src 'self' data: blob:");
    expect(policy).toContain("font-src 'self'");
    expect(policy).toContain("connect-src 'self' https://project.supabase.co");
    expect(policy).toContain("frame-src 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("upgrade-insecure-requests");
    expect(policy).not.toContain("unsafe-inline");
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).not.toContain(TURNSTILE_ORIGIN);
    expect(policy).not.toMatch(/(?:^|[\s;])\*(?:[\s;]|$)/m);
  });

  it("adds only the required Turnstile script and frame origin when configured", () => {
    const policy = buildCsp({
      nonce: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      environment: "production",
      supabaseUrl: "https://project.supabase.co",
      turnstileSiteKey: "0x4AAAA-test",
    });

    expect(policy).toContain(`script-src 'self' 'nonce-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' 'strict-dynamic' ${TURNSTILE_ORIGIN}`);
    expect(policy).toContain(`frame-src ${TURNSTILE_ORIGIN}`);
    expect(policy.match(/https:\/\/challenges\.cloudflare\.com/g)).toHaveLength(2);
  });

  it("fails closed on malformed Supabase configuration", () => {
    const policy = buildCsp({
      nonce: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      environment: "production",
      supabaseUrl: "https://project.supabase.co/path",
    });

    expect(policy).toContain("connect-src 'self'");
    expect(policy).not.toContain("project.supabase.co");
  });

  it("keeps the framework debugging allowance development-only", () => {
    const development = buildCsp({
      nonce: "cccccccccccccccccccccccccccccccc",
      environment: "development",
      supabaseUrl: "http://localhost:54321",
    });
    const production = buildCsp({
      nonce: "cccccccccccccccccccccccccccccccc",
      environment: "production",
      supabaseUrl: "https://project.supabase.co",
    });

    expect(development).toContain("'unsafe-eval'");
    expect(development).not.toContain("upgrade-insecure-requests");
    expect(development).toContain("connect-src 'self' http://localhost:54321");
    expect(production).not.toContain("'unsafe-eval'");
  });
});
