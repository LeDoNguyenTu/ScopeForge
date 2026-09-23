import { chmod, lstat, mkdir, unlink } from "node:fs/promises";
import {
  createConnection,
  createServer,
  type Server,
  type Socket,
} from "node:net";
import path from "node:path";
import {
  createProviderEgressAuthorizer,
  type ProviderEgressSession,
} from "./authorizer";
import {
  PROVIDER_EGRESS_CONTAINER_SOCKET_PATH,
  type ProviderEgressPolicy,
} from "./policy";
import {
  decodeProviderEgressConnectFrame,
  PROVIDER_EGRESS_TUNNEL_ACCEPTED,
  PROVIDER_EGRESS_TUNNEL_FRAME_MAX_BYTES,
} from "./tunnel-protocol";

export const PROVIDER_EGRESS_HOST_SOCKET_ROOT =
  "/run/scopeforge-worker/egress" as const;
const SOCKET_NAME_PATTERN = /^[a-f0-9]{64}[.]sock$/;

function fail(code: string): never {
  throw new Error(code);
}

function safeSocketPath(value: string): string {
  if (!path.isAbsolute(value) || /[,\r\n\u0000]/.test(value)) {
    return fail("PROVIDER_EGRESS_SOCKET_PATH_INVALID");
  }
  const normalized = path.normalize(value);
  if (path.dirname(normalized) !== PROVIDER_EGRESS_HOST_SOCKET_ROOT
      || !SOCKET_NAME_PATTERN.test(path.basename(normalized))) {
    return fail("PROVIDER_EGRESS_SOCKET_PATH_INVALID");
  }
  return normalized;
}

export function providerEgressHostSocketPath(socketToken: string): string {
  if (!/^[a-f0-9]{64}$/.test(socketToken)) {
    return fail("PROVIDER_EGRESS_SOCKET_TOKEN_INVALID");
  }
  return `${PROVIDER_EGRESS_HOST_SOCKET_ROOT}/${socketToken}.sock`;
}

async function assertPrivateSocketRoot(): Promise<void> {
  await mkdir(PROVIDER_EGRESS_HOST_SOCKET_ROOT, { recursive: true, mode: 0o700 });
  const stats = await lstat(PROVIDER_EGRESS_HOST_SOCKET_ROOT);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    return fail("PROVIDER_EGRESS_SOCKET_ROOT_INVALID");
  }
  if (typeof process.getuid !== "function" || stats.uid !== process.getuid()) {
    return fail("PROVIDER_EGRESS_SOCKET_ROOT_OWNERSHIP_INVALID");
  }
  await chmod(PROVIDER_EGRESS_HOST_SOCKET_ROOT, 0o700);
}

export interface ProviderEgressUnixTunnelDependencies {
  socketPath: string;
  policy: Readonly<ProviderEgressPolicy>;
  session: Readonly<ProviderEgressSession>;
  signal?: AbortSignal;
  now?: () => number;
  connectTarget?: (address: string, port: number) => Socket;
}

interface ActiveTunnel {
  client: Socket;
  target: Socket | null;
}

function defaultConnectTarget(address: string, port: number): Socket {
  return createConnection({ host: address, port, family: 4 });
}

export function createProviderEgressUnixTunnelServer(
  dependencies: ProviderEgressUnixTunnelDependencies,
) {
  const socketPath = safeSocketPath(dependencies.socketPath);
  const now = dependencies.now ?? Date.now;
  const authorizer = createProviderEgressAuthorizer({
    policy: dependencies.policy,
    session: dependencies.session,
    now,
  });
  const connectTarget = dependencies.connectTarget ?? defaultConnectTarget;
  const active = new Set<ActiveTunnel>();
  let server: Server | null = null;
  let deadlineTimer: NodeJS.Timeout | null = null;
  let closing: Promise<void> | null = null;
  const abortHandler = () => void close().catch(() => undefined);

  function destroyTunnel(tunnel: ActiveTunnel): void {
    active.delete(tunnel);
    tunnel.client.destroy();
    tunnel.target?.destroy();
  }

  function destroyAll(): void {
    for (const tunnel of [...active]) destroyTunnel(tunnel);
  }

  function handleClient(client: Socket): void {
    const tunnel: ActiveTunnel = { client, target: null };
    active.add(tunnel);
    let pending = Buffer.alloc(0);
    let state: "frame" | "connecting" | "streaming" | "closed" = "frame";

    const terminate = () => {
      if (state === "closed") return;
      state = "closed";
      destroyTunnel(tunnel);
    };

    const onFrameData = (chunk: Buffer) => {
      if (state !== "frame") return terminate();
      if (pending.length + chunk.length > PROVIDER_EGRESS_TUNNEL_FRAME_MAX_BYTES + 4) {
        return terminate();
      }
      pending = Buffer.concat([pending, chunk]);
      let decoded;
      try {
        decoded = decodeProviderEgressConnectFrame(pending);
      } catch {
        return terminate();
      }
      if (!decoded) return;
      if (decoded.consumedBytes !== pending.length) return terminate();

      let authorized;
      try {
        authorized = authorizer.authorizeConnect(decoded.value);
      } catch {
        return terminate();
      }

      state = "connecting";
      client.pause();
      client.removeListener("data", onFrameData);
      pending = Buffer.alloc(0);

      let target: Socket;
      try {
        target = connectTarget(authorized.address, authorized.port);
      } catch {
        return terminate();
      }
      tunnel.target = target;

      const forward = (
        source: Socket,
        destination: Socket,
        chunkData: Buffer,
        direction: "to-target" | "from-target",
      ) => {
        try {
          authorizer.recordTraffic(direction === "to-target"
            ? { bytesToTarget: chunkData.length, bytesFromTarget: 0 }
            : { bytesToTarget: 0, bytesFromTarget: chunkData.length });
        } catch {
          return terminate();
        }
        if (!destination.write(chunkData)) {
          source.pause();
          destination.once("drain", () => {
            if (state === "streaming" && !source.destroyed) source.resume();
          });
        }
      };

      target.once("connect", () => {
        if (state !== "connecting") return terminate();
        state = "streaming";
        client.write(PROVIDER_EGRESS_TUNNEL_ACCEPTED);
        client.on("data", (data) => forward(client, target, data, "to-target"));
        target.on("data", (data) => forward(target, client, data, "from-target"));
        client.resume();
      });
      target.once("error", terminate);
      target.once("close", terminate);
    };

    client.on("data", onFrameData);
    client.once("error", terminate);
    client.once("close", terminate);
  }

  async function start(): Promise<void> {
    if (server || closing) fail("PROVIDER_EGRESS_TUNNEL_STATE_INVALID");
    if (dependencies.signal?.aborted) {
      throw new DOMException("cancelled", "AbortError");
    }

    await assertPrivateSocketRoot();
    await unlink(socketPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });

    const nextServer = createServer(handleClient);
    await new Promise<void>((resolve, reject) => {
      const failStart = (error: Error) => reject(error);
      nextServer.once("error", failStart);
      nextServer.listen(socketPath, () => {
        nextServer.off("error", failStart);
        resolve();
      });
    });
    server = nextServer;
    try {
      await chmod(socketPath, 0o666);
    } catch (error) {
      await close();
      throw error;
    }

    const remainingMs = Date.parse(dependencies.session.expiresAt) - now();
    if (!Number.isFinite(remainingMs)
        || remainingMs < 1
        || remainingMs > dependencies.policy.budget.maxWallTimeMs) {
      await close();
      fail("PROVIDER_EGRESS_SESSION_INVALID");
    }
    deadlineTimer = setTimeout(() => void close().catch(() => undefined), remainingMs);
    deadlineTimer.unref?.();
    dependencies.signal?.addEventListener("abort", abortHandler, { once: true });
    if (dependencies.signal?.aborted) {
      await close();
      throw new DOMException("cancelled", "AbortError");
    }
  }

  async function close(): Promise<void> {
    if (closing) return closing;
    closing = (async () => {
      dependencies.signal?.removeEventListener("abort", abortHandler);
      if (deadlineTimer) {
        clearTimeout(deadlineTimer);
        deadlineTimer = null;
      }
      destroyAll();
      const activeServer = server;
      server = null;
      if (activeServer) {
        await new Promise<void>((resolve) => activeServer.close(() => resolve()));
      }
      await unlink(socketPath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    })();
    try {
      await closing;
    } finally {
      closing = null;
    }
  }

  return Object.freeze({
    start,
    close,
    socketPath,
    snapshot: authorizer.snapshot,
  });
}
