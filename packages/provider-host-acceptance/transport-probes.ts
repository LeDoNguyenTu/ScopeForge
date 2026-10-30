import { randomBytes } from "node:crypto";
import { access } from "node:fs/promises";
import { createConnection, type Socket } from "node:net";
import { connect as connectTls } from "node:tls";
import {
  createProviderEgressUnixTunnelServer,
  providerEgressHostSocketPath,
  type ProviderEgressBudget,
  type ProviderEgressPolicy,
} from "../provider-egress-boundary";

export function acceptanceAssert(condition: unknown, code = "PHASE12_ACCEPTANCE_CHECK_FAILED"): asserts condition {
  if (!condition) throw new Error(code);
}

export function connectAcceptanceTarget(
  policy: Readonly<ProviderEgressPolicy>, active: Set<Socket>, authorityExpiresAt: number,
) {
  const dials: { address: string; port: number }[] = [];
  let targetBytes = 0;
  return {
    dials,
    observedTargetBytes: () => targetBytes,
    connectTarget(address: string, port: number) {
      acceptanceAssert(Number.isFinite(authorityExpiresAt) && Date.now() < authorityExpiresAt,
        "PHASE12_ACCEPTANCE_AUTHORITY_EXPIRED");
      acceptanceAssert(policy.resolvedIpv4Addresses.includes(address) && port === policy.port);
      dials.push({ address, port });
      const socket = createConnection({ host: address, port, family: 4 });
      active.add(socket);
      socket.on("data", (bytes) => { targetBytes += bytes.length; });
      socket.once("close", () => active.delete(socket));
      return socket;
    },
  };
}

export async function assertAcceptanceSocketRemoved(socketPath: string): Promise<void> {
  const exists = await access(socketPath).then(() => true, (error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
    return false;
  });
  acceptanceAssert(!exists);
}

async function closed(socket: Socket): Promise<void> {
  if (socket.closed) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { socket.destroy(); reject(new Error("PHASE12_ACCEPTANCE_CLOSE_TIMEOUT")); }, 2_000);
    socket.once("close", () => { clearTimeout(timer); resolve(); });
  });
}

async function sendFrame(socketPath: string, frame: unknown, accepted: boolean): Promise<Socket> {
  const socket = createConnection({ path: socketPath });
  // Errors are observations only; acceptance is decided by the handshake and close event.
  socket.on("error", () => undefined);
  try {
    await new Promise<void>((resolve, reject) => {
      let received = false;
      const timer = setTimeout(() => { socket.destroy(); reject(new Error("PHASE12_ACCEPTANCE_HANDSHAKE_TIMEOUT")); }, 2_000);
      const finish = (error?: Error) => { clearTimeout(timer); error ? reject(error) : resolve(); };
      socket.once("connect", () => {
        const payload = Buffer.from(JSON.stringify(frame));
        const length = Buffer.alloc(4); length.writeUInt32BE(payload.length);
        socket.write(Buffer.concat([length, payload]));
      });
      socket.once("data", (bytes) => {
        received = true;
        if (!accepted || bytes.length !== 1 || bytes[0] !== 0) {
          finish(new Error("PHASE12_ACCEPTANCE_UNEXPECTED_HANDSHAKE"));
        } else finish();
      });
      socket.once("close", () => {
        if (!received) finish(accepted ? new Error("PHASE12_ACCEPTANCE_HANDSHAKE_REJECTED") : undefined);
      });
    });
    return socket;
  } catch (error) { socket.destroy(); throw error; }
}

/** Uses real pinned dialing; there is deliberately no injectable connector in this executable harness. */
export async function runHostTunnelTransportProbes(policy: Readonly<ProviderEgressPolicy>, authorityExpiresAt: number) {
  const results: Record<string, boolean> = {};
  const allDials: { address: string; port: number }[] = [];
  const scenarios = ["hostileFrames", "connections", "upload", "download", "deadline", "cancellation"] as const;
  for (const scenario of scenarios) {
    const nonce = randomBytes(32).toString("hex");
    const socketPath = providerEgressHostSocketPath(randomBytes(32).toString("hex"));
    const budget: ProviderEgressBudget = { ...policy.budget,
      maxConnections: scenario === "connections" ? 1 : 8,
      maxBytesToTarget: scenario === "upload" ? 1 : policy.budget.maxBytesToTarget,
      maxBytesFromTarget: scenario === "download" ? 1 : policy.budget.maxBytesFromTarget,
      maxWallTimeMs: Math.min(scenario === "deadline" ? 600 : 4_000, authorityExpiresAt - Date.now()) };
    acceptanceAssert(budget.maxWallTimeMs > 0, "PHASE12_ACCEPTANCE_AUTHORITY_EXPIRED");
    const active = new Set<Socket>();
    const connector = connectAcceptanceTarget(policy, active, authorityExpiresAt);
    const controller = new AbortController();
    const tunnel = createProviderEgressUnixTunnelServer({ socketPath, policy: { ...policy, budget },
      session: { nonce, expiresAt: new Date(Date.now() + budget.maxWallTimeMs).toISOString() },
      signal: controller.signal, connectTarget: connector.connectTarget });
    const frame = { schemaVersion: 1, operation: "connect", nonce, hostname: policy.hostname, port: policy.port };
    let client: Socket | undefined;
    try {
      await tunnel.start();
      if (scenario === "hostileFrames") {
        for (const bad of [
          { ...frame, hostname: `wrong.${policy.hostname}` },
          { ...frame, port: policy.port === 65535 ? 65534 : policy.port + 1 },
          { ...frame, nonce: "0".repeat(64) }, { ...frame, extra: true },
          { ...frame, hostname: policy.resolvedIpv4Addresses[0] },
        ]) await sendFrame(socketPath, bad, false);
        acceptanceAssert(connector.dials.length === 0 && tunnel.snapshot().connections === 0);
      } else {
        client = await sendFrame(socketPath, frame, true);
        if (scenario === "connections") {
          await sendFrame(socketPath, frame, false);
          acceptanceAssert(connector.dials.length === 1 && tunnel.snapshot().connections === 1);
        } else if (scenario === "upload") {
          client.write(Buffer.from("xx"));
          await closed(client);
          acceptanceAssert(tunnel.snapshot().bytesToTarget === 0);
        } else if (scenario === "download") {
          let received = 0;
          client.on("data", (bytes) => { received += bytes.length; });
          if (policy.scheme === "https") {
            // The first TLS response already exceeds the one-byte download ceiling.
            // SNI and normal certificate verification remain bound to the reviewed hostname.
            const tls = connectTls({ socket: client, servername: policy.hostname });
            tls.on("error", () => undefined);
          } else {
            client.write(`GET / HTTP/1.0\r\nHost: ${policy.hostname}\r\n\r\n`);
          }
          await closed(client);
          acceptanceAssert(connector.observedTargetBytes() > 1
            && received === 0 && tunnel.snapshot().bytesFromTarget === 0);
        } else if (scenario === "deadline") {
          const started = Date.now();
          await closed(client);
          acceptanceAssert(Date.now() - started >= 450);
          await new Promise<void>((resolve) => setTimeout(resolve, 25));
          await assertAcceptanceSocketRemoved(socketPath);
        } else {
          acceptanceAssert([...active].some((socket) => !socket.destroyed));
          controller.abort();
          await closed(client);
        }
      }
      results[scenario] = true;
    } finally {
      client?.destroy();
      await tunnel.close();
      await tunnel.close();
      await assertAcceptanceSocketRemoved(socketPath);
      // Socket.destroy() is synchronous; close events are delivered on the next event-loop turn.
      await new Promise<void>((resolve) => setImmediate(resolve));
      acceptanceAssert([...active].every((socket) => socket.destroyed));
      allDials.push(...connector.dials);
    }
  }
  return Object.freeze({ checks: results, dials: allDials, cleanup: true });
}
