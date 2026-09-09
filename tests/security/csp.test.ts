import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const cspPath = join(process.cwd(), "lib/security/csp.ts");
const source = () => existsSync(cspPath) ? readFileSync(cspPath, "utf8") : "";

describe("strict CSP policy contract", () => {
  it("provides a dedicated CSP policy module", () => {
    expect(existsSync(cspPath)).toBe(true);
  });

  it("exposes nonce, origin-normalization, and policy construction boundaries", () => {
    const csp = source();
    expect(csp).toMatch(/export function createCspNonce\s*\(/);
    expect(csp).toMatch(/export function normalizeBrowserOrigin\s*\(/);
    expect(csp).toMatch(/export function buildCsp\s*\(/);
    expect(csp).toContain("CspEnvironment");
    expect(csp).toContain("BuildCspOptions");
  });

  it("pins the intended strict production directives", () => {
    const csp = source();
    for (const directive of [
      "default-src",
      "script-src",
      "style-src",
      "img-src",
      "font-src",
      "connect-src",
      "frame-src",
      "object-src",
      "base-uri",
      "form-action",
      "frame-ancestors",
      "upgrade-insecure-requests"
    ]) expect(csp).toContain(directive);
    expect(csp).toContain("strict-dynamic");
    expect(csp).toContain("https://challenges.cloudflare.com");
  });

  it("keeps unsafe eval development-only and forbids production unsafe-inline", () => {
    const csp = source();
    expect(csp).toContain("unsafe-eval");
    expect(csp).toMatch(/environment\s*===\s*["']development["']/);
    expect(csp).not.toMatch(/unsafe-inline/);
  });

  it("does not hard-code a wildcard browser source", () => {
    const csp = source();
    expect(csp).not.toMatch(/(?:^|[\s;])\*(?:[\s;]|$)/m);
  });
});
