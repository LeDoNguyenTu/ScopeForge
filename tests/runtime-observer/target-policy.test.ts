import { describe, expect, it } from "vitest";
import { assetRef } from "@/packages/security-domain";
import {
  type AuthorizedRuntimeTarget,
  validateInitialRuntimeUrl,
  validateRedirectTarget,
} from "@/packages/runtime-observer";

function target(overrides: Partial<AuthorizedRuntimeTarget> = {}): AuthorizedRuntimeTarget {
  return {
    assetRef: assetRef("asset-1"),
    kind: "web_application",
    canonicalUrl: "https://example.com/app",
    hostname: "example.com",
    ...overrides,
  };
}

describe("runtime target policy", () => {
  it("accepts the verified canonical HTTPS target", () => {
    expect(validateInitialRuntimeUrl(target()).href).toBe("https://example.com/app");
  });

  it.each([
    ["http://example.com/app", /HTTPS/i],
    ["https://example.com:444/app", /port 443/i],
    ["https://user:pass@example.com/app", /credentials/i],
  ])("rejects unsafe initial target %s", (canonicalUrl, message) => {
    expect(() => validateInitialRuntimeUrl(target({ canonicalUrl }))).toThrow(message);
  });

  it("rejects a canonical hostname outside the verified hostname", () => {
    expect(() => validateInitialRuntimeUrl(target({ canonicalUrl: "https://other.example/app" }))).toThrow(
      /verified hostname/i,
    );
  });

  it("allows a same-host relative redirect and strips fragments", () => {
    const decision = validateRedirectTarget(
      new URL("https://example.com/app"),
      "/login?next=%2Fapp#fragment",
      target(),
    );

    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      expect(decision.url.href).toBe("https://example.com/login?next=%2Fapp");
    }
  });

  it("does not authorize a redirect to another hostname", () => {
    expect(
      validateRedirectTarget(
        new URL("https://example.com/app"),
        "https://www.example.com/next",
        target(),
      ),
    ).toEqual({ allowed: false, reason: "CROSS_HOST" });
  });

  it("does not follow an HTTPS-to-HTTP redirect", () => {
    expect(
      validateRedirectTarget(new URL("https://example.com/app"), "http://example.com/next", target()),
    ).toEqual({ allowed: false, reason: "SCHEME" });
  });

  it("does not follow a redirect to another port", () => {
    expect(
      validateRedirectTarget(
        new URL("https://example.com/app"),
        "https://example.com:444/next",
        target(),
      ),
    ).toEqual({ allowed: false, reason: "PORT" });
  });

  it("does not follow a redirect containing credentials", () => {
    expect(
      validateRedirectTarget(
        new URL("https://example.com/app"),
        "https://user:pass@example.com/next",
        target(),
      ),
    ).toEqual({ allowed: false, reason: "CREDENTIALS" });
  });
});
