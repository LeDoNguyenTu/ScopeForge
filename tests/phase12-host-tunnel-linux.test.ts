// @vitest-environment node
import { createServer, type Socket } from "node:net";
import { describe, expect, it } from "vitest";
import { runHostTunnelTransportProbes } from "../packages/provider-host-acceptance/transport-probes";
import type { ProviderEgressPolicy } from "../packages/provider-egress-boundary";

describe.skipIf(process.platform !== "linux")("real Unix tunnel transport probes", () => {
  async function fixture(sendResponse: boolean, run: (policy: ProviderEgressPolicy) => Promise<void>) {
    const active = new Set<Socket>();
    const server = createServer((socket) => {
      active.add(socket);
      socket.on("error", () => undefined);
      socket.once("close", () => active.delete(socket));
      socket.setTimeout(1_100, () => socket.destroy());
      socket.on("data", (bytes) => {
        // No hostile/upload application bytes may reach this controlled target.
        expect(bytes.toString("ascii").startsWith("GET / HTTP/1.0\r\n")).toBe(true);
        if (sendResponse) socket.end("HTTP/1.0 200 OK\r\nContent-Length: 8\r\n\r\nfixture\n");
        else socket.end();
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("fixture");
      // The unit fixture bypasses public authority only by constructing this in-memory test policy.
      // The executable entry always uses the strict reviewed-file + full-DNS policy validators.
      await run({ provider: "httpx", hostname: "fixture.example", scheme: "http", port: address.port,
        resolvedIpv4Addresses: ["127.0.0.1"], budget: { maxConnections: 8,
          maxBytesToTarget: 131_072, maxBytesFromTarget: 1_048_576, maxWallTimeMs: 10_000 } });
    } finally {
      for (const socket of active) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  it("proves hostile frames, connection/byte/deadline budgets, cancellation and repeated cleanup", async () => {
    await fixture(true, async (policy) => {
      const result = await runHostTunnelTransportProbes(policy, Date.now() + 30_000);
      expect(result.checks).toEqual({ hostileFrames: true, connections: true, upload: true,
        download: true, deadline: true, cancellation: true });
      expect(result.dials).toHaveLength(5);
      expect(result.dials.every((dial) => dial.address === "127.0.0.1" && dial.port === policy.port)).toBe(true);
      expect(result.cleanup).toBe(true);
    });
  });

  it("does not falsely accept download exhaustion when the target sent no bytes", async () => {
    await fixture(false, async (policy) => {
      await expect(runHostTunnelTransportProbes(policy, Date.now() + 30_000)).rejects.toThrow();
    });
  });
});
