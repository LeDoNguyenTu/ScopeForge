import { describe, expect, it } from "vitest";
import { normalizeAssetTarget } from "@/lib/assets/normalize-target";

describe("normalizeAssetTarget", () => {
  it("normalizes a public HTTPS application", () => {
    expect(normalizeAssetTarget(" https://Example.COM/ ", "web_application")).toEqual({
      canonicalTarget: "https://example.com",
      hostname: "example.com",
      kind: "web_application"
    });
  });

  it("preserves a meaningful application path without trailing slash", () => {
    expect(normalizeAssetTarget("https://example.com/api/", "api").canonicalTarget).toBe("https://example.com/api");
  });

  it.each([
    "https://localhost",
    "https://app.local",
    "https://service.internal",
    "https://127.0.0.1",
    "https://10.0.0.5",
    "https://172.20.1.4",
    "https://192.168.1.5",
    "https://169.254.169.254",
    "https://0.0.0.0",
    "https://[::1]",
    "https://[::ffff:127.0.0.1]"
  ])("rejects private or local target %s", (target) => {
    expect(() => normalizeAssetTarget(target, "web_application")).toThrow(/private or local targets/i);
  });

  it("rejects non-HTTPS targets", () => {
    expect(() => normalizeAssetTarget("http://example.com", "web_application")).toThrow(/requires HTTPS/i);
  });

  it("rejects non-standard verification ports", () => {
    expect(() => normalizeAssetTarget("https://example.com:8443", "web_application")).toThrow(/port 443/i);
  });

  it("rejects embedded credentials", () => {
    expect(() => normalizeAssetTarget("https://user:pass@example.com", "web_application")).toThrow(/credentials/i);
  });

  it("rejects fragments and query strings", () => {
    expect(() => normalizeAssetTarget("https://example.com/#admin", "web_application")).toThrow(/fragments/i);
    expect(() => normalizeAssetTarget("https://example.com/?debug=1", "web_application")).toThrow(/query strings/i);
  });

  it("normalizes a public GitHub repository", () => {
    expect(normalizeAssetTarget("https://github.com/LeDoNguyenTu/ScopeForge.git", "repository")).toEqual({
      canonicalTarget: "https://github.com/LeDoNguyenTu/ScopeForge",
      hostname: "github.com",
      kind: "repository"
    });
  });

  it("rejects unsupported repository hosts", () => {
    expect(() => normalizeAssetTarget("https://gitlab.com/example/project", "repository")).toThrow(/GitHub URLs only/i);
  });

  it("rejects malformed input", () => {
    expect(() => normalizeAssetTarget("not a url", "api")).toThrow(/valid absolute URL/i);
  });
});
