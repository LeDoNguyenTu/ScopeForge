import {
  createConnection,
  createServer,
  type Server,
  type Socket,
} from "node:net";
import {
  parseAuthorizedSocks5ConnectRequest,
  parseSocks5Greeting,
  SOCKS5_CONNECT_SUCCESS_RESPONSE,
  SOCKS5_NO_AUTH_RESPONSE,
  type ProviderEgressSocksTarget,
} from "./socks5";
import {
  PROVIDER_EGRESS_LIMITS,
  PROVIDER_EGRESS_LOOPBACK_HOST,
  PROVIDER_EGRESS_LOOPBACK_PORT,
} from "./policy";
import { PROVIDER_EGRESS_CONTAINER_SOCKET_PATH } from "./unix-tunnel";
import {
  encodeProviderEgressConnectFrame,
  PROVIDER_EGRESS_TUNNEL_ACCEPTED,
  PROVIDER_EGRESS_TUNNEL_FRAME_MAX_BYTES,
} from "./tunnel-protocol";

const SOCKS5_GENERAL_FAILURE =
  Buffer.from([0x05, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

function fail(code: string): never {
  throw new Error(code);
}

export interface ProviderEgressLoopbackSocksDependencies {
  target: Readonly<ProviderEgressSocksTarget>;
  sessionNonce: string;
  signal?: AbortSignal;
}

export function createProviderEgressLoopbackSocksServer(
  dependencies: ProviderEgressLoopbackSocksDependencies,
) {
  if (!/^[a-f0-9]{64}$/.test(dependencies.sessionNonce)) {
    fail("PROVIDER_EGRESS_SESSION_INVALID");
  }

  const active = new Map<Socket, () => void>();
  let server: Server | null = null;
  let closing: Promise<void> | null = null;
  const abortHandler = () => void close().catch(() => undefined);

  function terminate(client: Socket, tunnel?: Socket | null, reply = false): void {
    active.delete(client);
    if (reply && !client.destroyed) client.write(SOCKS5_GENERAL_FAILURE);
    client.destroy();
    tunnel?.destroy();
  }

  function handleClient(client: Socket): void {
    if (active.size >= PROVIDER_EGRESS_LIMITS.maxConnections) {
      return terminate(client);
    }
    let stage: "greeting" | "request" | "tunnel" | "streaming" | "closed" = "greeting";
    let pending = Buffer.alloc(0);
    let tunnel: Socket | null = null;

    const closePair = (reply = false) => {
      if (stage === "closed") return;
      stage = "closed";
      terminate(client, tunnel, reply);
    };
    active.set(client, () => closePair());

    const onHandshakeData = (chunk: Buffer) => {
      if (stage !== "greeting" && stage !== "request") return closePair();
      if (pending.length + chunk.length > PROVIDER_EGRESS_TUNNEL_FRAME_MAX_BYTES) {
        return closePair(stage === "request");
      }
      pending = Buffer.concat([pending, chunk]);

      if (stage === "greeting") {
        let greeting;
        try {
          greeting = parseSocks5Greeting(pending);
        } catch {
          return closePair();
        }
        if (!greeting) return;
        if (greeting.consumedBytes !== pending.length) return closePair();
        pending = Buffer.alloc(0);
        stage = "request";
        client.write(SOCKS5_NO_AUTH_RESPONSE);
        return;
      }

      let request;
      try {
        request = parseAuthorizedSocks5ConnectRequest(pending, dependencies.target);
      } catch {
        return closePair(true);
      }
      if (!request) return;
      if (request.consumedBytes !== pending.length) return closePair(true);
      pending = Buffer.alloc(0);
      stage = "tunnel";
      client.pause();
      client.removeListener("data", onHandshakeData);

      tunnel = createConnection({ path: PROVIDER_EGRESS_CONTAINER_SOCKET_PATH });
      const currentTunnel = tunnel;
      currentTunnel.once("error", () => closePair(true));
      currentTunnel.once("close", () => closePair());
      currentTunnel.once("connect", () => {
        try {
          currentTunnel.write(encodeProviderEgressConnectFrame({
            schemaVersion: 1,
            operation: "connect",
            nonce: dependencies.sessionNonce,
            hostname: request.hostname,
            port: request.port,
          }));
        } catch {
          closePair(true);
        }
      });
      currentTunnel.once("data", (ack) => {
        if (stage !== "tunnel"
            || ack.length !== PROVIDER_EGRESS_TUNNEL_ACCEPTED.length
            || !ack.equals(PROVIDER_EGRESS_TUNNEL_ACCEPTED)) {
          return closePair(true);
        }
        stage = "streaming";
        client.write(SOCKS5_CONNECT_SUCCESS_RESPONSE);

        client.on("data", (data) => {
          if (!currentTunnel.write(data)) {
            client.pause();
            currentTunnel.once("drain", () => {
              if (stage === "streaming" && !client.destroyed) client.resume();
            });
          }
        });
        currentTunnel.on("data", (data) => {
          if (!client.write(data)) {
            currentTunnel.pause();
            client.once("drain", () => {
              if (stage === "streaming" && !currentTunnel.destroyed) currentTunnel.resume();
            });
          }
        });
        client.resume();
      });
    };

    client.on("data", onHandshakeData);
    client.once("error", () => closePair());
    client.once("close", () => closePair());
  }

  async function start(): Promise<void> {
    if (server || closing) fail("PROVIDER_EGRESS_SOCKS_STATE_INVALID");
    if (dependencies.signal?.aborted) throw new DOMException("cancelled", "AbortError");

    const nextServer = createServer(handleClient);
    await new Promise<void>((resolve, reject) => {
      const failStart = (error: Error) => reject(error);
      nextServer.once("error", failStart);
      nextServer.listen({
        host: PROVIDER_EGRESS_LOOPBACK_HOST,
        port: PROVIDER_EGRESS_LOOPBACK_PORT,
        exclusive: true,
      }, () => {
        nextServer.off("error", failStart);
        resolve();
      });
    });
    server = nextServer;
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
      for (const closePair of [...active.values()]) closePair();
      const activeServer = server;
      server = null;
      if (activeServer) {
        await new Promise<void>((resolve) => activeServer.close(() => resolve()));
      }
    })();
    try {
      await closing;
    } finally {
      closing = null;
    }
  }

  return Object.freeze({ start, close });
}
