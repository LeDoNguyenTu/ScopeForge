import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createServer, type Socket } from "node:net";
import {
  prepareHostTunnelAcceptance,
  validateAcceptanceAuthorization,
} from "../packages/provider-host-acceptance/authorization";
import { connectAcceptanceTarget } from "../packages/provider-host-acceptance/transport-probes";
import { validateResourceSnapshot } from "../packages/provider-host-acceptance/sandbox-probes";

const now = Date.parse("2026-10-30T10:00:00Z");
const sourceSha = "a".repeat(40);
const providerImage = `localhost/scopeforge-httpx-worker@sha256:${"b".repeat(64)}`;
const sidecarImage = `localhost/scopeforge-provider-egress-sidecar@sha256:${"c".repeat(64)}`;
const authorization = () => ({
  schemaVersion: 1,
  purpose: "phase12-controlled-acceptance",
  reviewedBy: "LeDoNguyenTu",
  authorizationId: "phase12-acceptance:review-1",
  sourceSha,
  providerImage,
  sidecarImage,
  expiresAt: "2026-10-30T11:00:00Z",
  target: { hostname: "acceptance.example.com", scheme: "https", port: 443 },
  approvedIpv4Addresses: ["93.184.216.34"],
});

describe("host-owned pinned connector", () => {
  it("rejects an unpinned IP or wrong port before opening a socket", async () => {
    const policy = await prepareHostTunnelAcceptance(validate(), async () => ["93.184.216.34"]);
    const connector = connectAcceptanceTarget(policy, new Set());
    expect(() => connector.connectTarget("127.0.0.1", 443)).toThrow();
    expect(() => connector.connectTarget("93.184.216.34", 80)).toThrow();
    expect(connector.dials).toEqual([]);
  });

  it("observes actual target data and closes the same host TCP connection", async () => {
    const server = createServer((socket) => { socket.end("fixture"); });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("fixture");
      // Loopback is used solely in this local unit fixture, never in executable acceptance authority.
      const policy = { ...(await prepareHostTunnelAcceptance(validate(), async () => ["93.184.216.34"])),
        port: address.port, resolvedIpv4Addresses: ["127.0.0.1"] };
      const active = new Set<Socket>();
      const connector = connectAcceptanceTarget(policy, active);
      const socket = connector.connectTarget("127.0.0.1", address.port);
      socket.resume();
      await new Promise<void>((resolve) => socket.once("close", resolve));
      expect(connector.observedTargetBytes()).toBe(7);
      expect(active.size).toBe(0);
      expect(connector.dials).toEqual([{ address: "127.0.0.1", port: address.port }]);
    } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
  });
});

describe("actual Linux resource snapshots", () => {
  const snapshot = { memory: "268435456", swap: "0", pids: "32", cpu: "50000 100000",
    effectiveCapabilities: "0000000000000000", boundingCapabilities: "0000000000000000" };
  it("requires the unchanged cgroup ceilings for the real provider and trusted sidecar", () => {
    expect(validateResourceSnapshot(snapshot, "provider")).toEqual(snapshot);
    expect(validateResourceSnapshot({ ...snapshot, pids: "8" }, "sidecar").pids).toBe("8");
    for (const change of [{ pids: "max" }, { memory: "max" }, { swap: "max" }, { cpu: "max 100000" },
      { effectiveCapabilities: "0000000000000001" }, { boundingCapabilities: "0000000000000001" }]) {
      expect(() => validateResourceSnapshot({ ...snapshot, ...change }, "provider")).toThrow();
    }
    expect(() => validateResourceSnapshot({ ...snapshot, pids: "32" }, "sidecar")).toThrow();
  });
});
function encoded(value: unknown = authorization()) {
  const bytes = Buffer.from(JSON.stringify(value));
  return { bytes, digest: createHash("sha256").update(bytes).digest("hex") };
}
function validate(value: unknown = authorization()) {
  const { bytes, digest } = encoded(value);
  return validateAcceptanceAuthorization(bytes, digest, sourceSha, now);
}

describe("Phase 12 reviewed acceptance authority", () => {
  it("binds exact source, immutable images, target, pins and expiry to reviewed file bytes", () => {
    expect(validate()).toMatchObject({ sourceSha, providerImage, sidecarImage,
      target: { hostname: "acceptance.example.com", scheme: "https", port: 443 } });
    const { bytes, digest } = encoded();
    expect(() => validateAcceptanceAuthorization(bytes, "f".repeat(64), sourceSha, now)).toThrow();
    expect(() => validateAcceptanceAuthorization(bytes, digest, "d".repeat(40), now)).toThrow();
    expect(() => validateAcceptanceAuthorization(bytes, digest, sourceSha, now + 3_600_000)).toThrow();
  });

  it.each([
    { ...authorization(), command: "curl" },
    { ...authorization(), reviewedBy: "unreviewed" },
    { ...authorization(), providerImage: "localhost/provider:latest" },
    { ...authorization(), expiresAt: "2026-11-01T00:00:00Z" },
    { ...authorization(), target: { ...authorization().target, path: "/admin" } },
    { ...authorization(), target: { ...authorization().target, hostname: "127.0.0.1" } },
    { ...authorization(), target: { ...authorization().target, hostname: "acceptance.example.com/path" } },
    { ...authorization(), approvedIpv4Addresses: ["10.0.0.1"] },
    { ...authorization(), approvedIpv4Addresses: ["93.184.216.34", "93.184.216.34"] },
  ])("rejects widened, stale or nonpublic authority %#", (input) => {
    expect(() => validate(input)).toThrow();
  });

  it("validates every raw host DNS answer before selecting any address", async () => {
    const approved = validate();
    for (const answers of [
      ["93.184.216.34", "127.0.0.1"], ["93.184.216.34", "::1"],
      ["93.184.216.34", "2606:4700:4700::1111"], ["1.1.1.1"], [],
    ]) {
      const resolve = vi.fn().mockResolvedValue(answers);
      await expect(prepareHostTunnelAcceptance(approved, resolve)).rejects.toThrow();
      expect(resolve).toHaveBeenCalledExactlyOnceWith("acceptance.example.com");
    }
    const prepared = await prepareHostTunnelAcceptance(approved, async () => ["93.184.216.34"]);
    expect(prepared.resolvedIpv4Addresses).toEqual(["93.184.216.34"]);
    expect(prepared.budget.maxConnections).toBe(8);
  });
});
