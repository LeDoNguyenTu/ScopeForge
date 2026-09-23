import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  decodeProviderEgressConnectFrame,
  encodeProviderEgressConnectFrame,
  providerEgressHostSocketPath,
  PROVIDER_EGRESS_CONTAINER_SOCKET_PATH,
  PROVIDER_EGRESS_HOST_SOCKET_ROOT,
  PROVIDER_EGRESS_TUNNEL_FRAME_MAX_BYTES,
} from "../packages/provider-egress-boundary";

const tunnelSource = path.resolve("packages/provider-egress-boundary/unix-tunnel.ts");
const loopbackSource = path.resolve("packages/provider-egress-boundary/loopback-socks5.ts");

describe("Phase 12 provider egress tunnel protocol", () => {
  it("round-trips one bounded connect frame", () => {
    const frame = {
      schemaVersion: 1 as const,
      operation: "connect" as const,
      nonce: "a".repeat(64),
      hostname: "scopeforge.dev",
      port: 443,
    };
    const encoded = encodeProviderEgressConnectFrame(frame);
    const decoded = decodeProviderEgressConnectFrame(encoded);
    expect(decoded).toEqual({ value: frame, consumedBytes: encoded.length });
    expect(encoded.length).toBeLessThanOrEqual(PROVIDER_EGRESS_TUNNEL_FRAME_MAX_BYTES + 4);
  });

  it("rejects malformed and oversized tunnel frames", () => {
    const oversized = Buffer.alloc(4);
    oversized.writeUInt32BE(PROVIDER_EGRESS_TUNNEL_FRAME_MAX_BYTES + 1);
    expect(() => decodeProviderEgressConnectFrame(oversized))
      .toThrow("PROVIDER_EGRESS_FRAME_INVALID");

    const malformed = Buffer.alloc(5);
    malformed.writeUInt32BE(1);
    malformed[4] = 0xff;
    expect(() => decodeProviderEgressConnectFrame(malformed))
      .toThrow("PROVIDER_EGRESS_FRAME_INVALID");
  });

  it("keeps host socket paths inside the supervisor-owned Linux path budget", () => {
    const socketPath = providerEgressHostSocketPath("b".repeat(64));
    expect(socketPath.startsWith(`${PROVIDER_EGRESS_HOST_SOCKET_ROOT}/`)).toBe(true);
    expect(Buffer.byteLength(socketPath, "utf8")).toBeLessThanOrEqual(107);
    expect(PROVIDER_EGRESS_CONTAINER_SOCKET_PATH).toBe("/run/scopeforge/egress.sock");
    expect(() => providerEgressHostSocketPath("../escape"))
      .toThrow("PROVIDER_EGRESS_SOCKET_TOKEN_INVALID");
  });

  it("keeps real target dialing host-owned, IPv4-literal and free of DNS lookup", async () => {
    const source = await readFile(tunnelSource, "utf8");
    expect(source).toContain("createConnection({ host: address, port, family: 4 })");
    expect(source).not.toContain("lookup(");
    expect(source).toContain("authorizer.authorizeConnect(decoded.value)");
    expect(source).toContain("authorizer.recordTraffic");
    expect(source).toContain("chmod(PROVIDER_EGRESS_HOST_SOCKET_ROOT, 0o700)");
    expect(source).toContain("chmod(socketPath, 0o666)");
  });

  it("keeps the provider-side proxy on loopback plus the fixed Unix tunnel only", async () => {
    const source = await readFile(loopbackSource, "utf8");
    expect(source).toContain("host: PROVIDER_EGRESS_LOOPBACK_HOST");
    expect(source).toContain("port: PROVIDER_EGRESS_LOOPBACK_PORT");
    expect(source).toContain("path: PROVIDER_EGRESS_CONTAINER_SOCKET_PATH");
    expect(source).not.toContain("createConnection({ host:");
    expect(source).not.toContain("./unix-tunnel");
    expect(source).not.toContain("lookup(");
    expect(source).toContain("parseAuthorizedSocks5ConnectRequest");
    expect(source).toContain("dependencies.target");
    expect(source).not.toContain("resolvedIpv4Addresses");
    expect(source).not.toContain("dependencies.policy");
  });

  it("rejects pipelined pre-authorization application bytes in both halves", async () => {
    const [host, loopback] = await Promise.all([
      readFile(tunnelSource, "utf8"),
      readFile(loopbackSource, "utf8"),
    ]);
    expect(host).toContain("decoded.consumedBytes !== pending.length");
    expect(loopback).toContain("request.consumedBytes !== pending.length");
  });
});
