import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseProviderEgressSidecarInput } from "../packages/provider-egress-sidecar/input";

describe("Phase 12 provider egress sidecar", () => {
  it("accepts only exact target plus one task nonce", () => {
    expect(parseProviderEgressSidecarInput([
      "--trusted-hostname", "ScopeForge.dev",
      "--port", "443",
      "--session-nonce", "a".repeat(64),
    ])).toEqual({
      target: { hostname: "scopeforge.dev", port: 443 },
      sessionNonce: "a".repeat(64),
    });
  });

  it("rejects unknown arguments, unsafe hosts, invalid ports and invalid nonces", () => {
    expect(() => parseProviderEgressSidecarInput([
      "--trusted-hostname", "scopeforge.dev",
      "--port", "443",
      "--session-nonce", "a".repeat(64),
      "--proxy", "socks5://attacker.invalid:1080",
    ])).toThrow("PROVIDER_EGRESS_SIDECAR_ARGUMENT_UNKNOWN");

    for (const hostname of ["127.0.0.1", "scopeforge.dev/path", "localhost", "api.internal"]) {
      expect(() => parseProviderEgressSidecarInput([
        "--trusted-hostname", hostname,
        "--port", "443",
        "--session-nonce", "a".repeat(64),
      ])).toThrow(/PROVIDER_EGRESS_HOST/);
    }

    expect(() => parseProviderEgressSidecarInput([
      "--trusted-hostname", "scopeforge.dev",
      "--port", "0",
      "--session-nonce", "a".repeat(64),
    ])).toThrow("PROVIDER_EGRESS_SIDECAR_PORT_INVALID");

    expect(() => parseProviderEgressSidecarInput([
      "--trusted-hostname", "scopeforge.dev",
      "--port", "443",
      "--session-nonce", "not-a-secret",
    ])).toThrow("PROVIDER_EGRESS_SIDECAR_NONCE_INVALID");
  });

  it("builds a sidecar artifact that contains no external provider binary", async () => {
    const [buildSource, containerSource] = await Promise.all([
      readFile(path.resolve("scripts/build-workers.mjs"), "utf8"),
      readFile(path.resolve("deploy/worker/Containerfile.provider-egress-sidecar"), "utf8"),
    ]);
    expect(buildSource).toContain("provider-egress-sidecar-entry.js");
    expect(containerSource).toContain("provider-egress-sidecar-entry.js");
    expect(containerSource).not.toContain("httpx");
    expect(containerSource).not.toContain("nuclei");
  });
});
