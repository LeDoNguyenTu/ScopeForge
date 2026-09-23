import { describe, expect, it } from "vitest";
import {
  createProviderEgressAuthorizer,
  createProviderEgressPolicy,
  fixedProviderProxyArgs,
  parseAuthorizedSocks5ConnectRequest,
  parseSocks5Greeting,
  PROVIDER_EGRESS_LOOPBACK_PROXY_URL,
} from "../packages/provider-egress-boundary";

function policy() {
  return createProviderEgressPolicy({
    provider: "httpx",
    hostname: "ScopeForge.dev",
    scheme: "https",
    port: 443,
    resolvedAddresses: ["104.21.48.1", "172.67.1.2"],
    budget: {
      maxConnections: 2,
      maxBytesToTarget: 1024,
      maxBytesFromTarget: 4096,
      maxWallTimeMs: 8000,
    },
  });
}

function socksConnect(hostname: string, port: number): Buffer {
  const host = Buffer.from(hostname, "ascii");
  const request = Buffer.alloc(5 + host.length + 2);
  request.set([0x05, 0x01, 0x00, 0x03, host.length], 0);
  host.copy(request, 5);
  request.writeUInt16BE(port, 5 + host.length);
  return request;
}

describe("Phase 12 target-bound provider egress policy", () => {
  it("pins an exact public target and bounded host-side resource profile", () => {
    const value = policy();
    expect(value.hostname).toBe("scopeforge.dev");
    expect(value.port).toBe(443);
    expect(value.resolvedIpv4Addresses).toEqual(["104.21.48.1", "172.67.1.2"]);
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.budget)).toBe(true);
  });

  it("fails closed for local, private, documentation, carrier-grade NAT and IPv6 addresses", () => {
    for (const address of [
      "127.0.0.1",
      "10.0.0.1",
      "100.64.0.1",
      "169.254.169.254",
      "172.16.0.1",
      "192.168.0.1",
      "198.51.100.7",
      "203.0.113.8",
      "224.0.0.1",
      "2001:db8::1",
    ]) {
      expect(() => createProviderEgressPolicy({
        ...policy(),
        resolvedAddresses: [address],
      })).toThrow("PROVIDER_EGRESS_ADDRESS_SET_INVALID");
    }
  });

  it("rejects local target names, IP literals, duplicate answers and oversized budgets", () => {
    for (const hostname of ["localhost", "api.local", "127.0.0.1", "scopeforge.dev."]) {
      expect(() => createProviderEgressPolicy({ ...policy(), hostname }))
        .toThrow(/PROVIDER_EGRESS_HOST/);
    }
    expect(() => createProviderEgressPolicy({
      ...policy(),
      resolvedAddresses: ["104.21.48.1", "104.21.48.1"],
    })).toThrow("PROVIDER_EGRESS_ADDRESS_SET_INVALID");
    expect(() => createProviderEgressPolicy({
      ...policy(),
      resolvedAddresses: ["104.21.48.1", "2001:db8::1"],
    })).toThrow("PROVIDER_EGRESS_ADDRESS_SET_INVALID");
    expect(() => createProviderEgressPolicy({
      ...policy(),
      budget: { ...policy().budget, maxConnections: 9 },
    })).toThrow("PROVIDER_EGRESS_CONNECTION_BUDGET_INVALID");
  });

  it("uses only fixed loopback SOCKS5 proxy arguments for reviewed providers", () => {
    expect(PROVIDER_EGRESS_LOOPBACK_PROXY_URL).toBe("socks5://127.0.0.1:17777");
    expect(fixedProviderProxyArgs("httpx")).toEqual([
      "-http-proxy",
      "socks5://127.0.0.1:17777",
    ]);
    expect(fixedProviderProxyArgs("nuclei")).toEqual([
      "-proxy",
      "socks5://127.0.0.1:17777",
    ]);
  });

  it("accepts only SOCKS5 no-auth CONNECT for the exact trusted hostname and port", () => {
    expect(parseSocks5Greeting(Buffer.from([0x05, 0x01, 0x00])))
      .toEqual({ consumedBytes: 3 });
    expect(parseAuthorizedSocks5ConnectRequest(
      socksConnect("scopeforge.dev", 443),
      policy(),
    )).toEqual({
      hostname: "scopeforge.dev",
      port: 443,
      consumedBytes: socksConnect("scopeforge.dev", 443).length,
    });
    expect(() => parseAuthorizedSocks5ConnectRequest(
      socksConnect("example.com", 443),
      policy(),
    )).toThrow("PROVIDER_EGRESS_TARGET_MISMATCH");
    expect(() => parseAuthorizedSocks5ConnectRequest(
      socksConnect("scopeforge.dev", 80),
      policy(),
    )).toThrow("PROVIDER_EGRESS_TARGET_MISMATCH");

    const literalIpv4 = Buffer.from([0x05, 0x01, 0x00, 0x01, 1, 1, 1, 1, 0x01, 0xbb]);
    expect(() => parseAuthorizedSocks5ConnectRequest(literalIpv4, policy()))
      .toThrow("PROVIDER_EGRESS_SOCKS_ADDRESS_TYPE_INVALID");
  });

  it("authorizes only the pinned address set and enforces connection, byte and expiry budgets", () => {
    let now = Date.parse("2026-09-24T00:00:00Z");
    const value = policy();
    const authorizer = createProviderEgressAuthorizer({
      policy: value,
      session: {
        nonce: "a".repeat(64),
        expiresAt: "2026-09-24T00:00:08Z",
      },
      now: () => now,
    });
    const frame = {
      schemaVersion: 1 as const,
      operation: "connect" as const,
      nonce: "a".repeat(64),
      hostname: "scopeforge.dev",
      port: 443,
    };

    expect(authorizer.authorizeConnect(frame)).toEqual({
      address: "104.21.48.1",
      port: 443,
      connectionNumber: 1,
    });
    expect(authorizer.authorizeConnect(frame)).toEqual({
      address: "172.67.1.2",
      port: 443,
      connectionNumber: 2,
    });
    expect(() => authorizer.authorizeConnect(frame))
      .toThrow("PROVIDER_EGRESS_CONNECTION_BUDGET_EXHAUSTED");

    authorizer.recordTraffic({ bytesToTarget: 1024, bytesFromTarget: 4096 });
    expect(authorizer.snapshot()).toEqual({
      connections: 2,
      bytesToTarget: 1024,
      bytesFromTarget: 4096,
    });
    expect(() => authorizer.recordTraffic({ bytesToTarget: 1, bytesFromTarget: 0 }))
      .toThrow("PROVIDER_EGRESS_UPLOAD_BUDGET_EXHAUSTED");

    now = Date.parse("2026-09-24T00:00:08Z");
    expect(() => authorizer.recordTraffic({ bytesToTarget: 0, bytesFromTarget: 0 }))
      .toThrow("PROVIDER_EGRESS_SESSION_EXPIRED");
  });

  it("rejects sessions that outlive the authoritative wall-time budget", () => {
    expect(() => createProviderEgressAuthorizer({
      policy: policy(),
      session: {
        nonce: "d".repeat(64),
        expiresAt: "2026-09-24T00:00:09Z",
      },
      now: () => Date.parse("2026-09-24T00:00:00Z"),
    })).toThrow("PROVIDER_EGRESS_SESSION_INVALID");
  });

  it("rejects session substitution and extra frame fields", () => {
    const value = policy();
    const authorizer = createProviderEgressAuthorizer({
      policy: value,
      session: {
        nonce: "b".repeat(64),
        expiresAt: "2026-09-24T00:00:08Z",
      },
      now: () => Date.parse("2026-09-24T00:00:00Z"),
    });
    expect(() => authorizer.authorizeConnect({
      schemaVersion: 1,
      operation: "connect",
      nonce: "c".repeat(64),
      hostname: "scopeforge.dev",
      port: 443,
    })).toThrow("PROVIDER_EGRESS_SESSION_MISMATCH");
    expect(() => authorizer.authorizeConnect({
      schemaVersion: 1,
      operation: "connect",
      nonce: "b".repeat(64),
      hostname: "scopeforge.dev",
      port: 443,
      arbitraryUrl: "https://example.com",
    })).toThrow("PROVIDER_EGRESS_FRAME_INVALID");
  });
});
