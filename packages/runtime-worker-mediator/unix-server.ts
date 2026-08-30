import { chmod, mkdir, unlink } from "node:fs/promises";
import { createServer, type Server } from "node:net";
import path from "node:path";
import type { RuntimeMediatorRunRequest } from "./contracts";
import {
  createRuntimeMediatorFrameDecoder,
  encodeRuntimeMediatorFrame,
  RUNTIME_MEDIATOR_REQUEST_MAX_BYTES,
  RUNTIME_MEDIATOR_RESPONSE_MAX_BYTES,
} from "./unix-client";

export const RUNTIME_MEDIATOR_HOST_SOCKET_ROOT = "/run/scopeforge/runtime-mediator" as const;
const SOCKET_NAME_PATTERN = /^[a-f0-9]{64}[.]sock$/;

function safeSocketPath(value: string): string {
  if (!path.isAbsolute(value) || /[,\r\n\u0000]/.test(value)) {
    throw new Error("Runtime mediator socket path is invalid.");
  }
  const normalized = path.normalize(value);
  if (path.dirname(normalized) !== RUNTIME_MEDIATOR_HOST_SOCKET_ROOT
      || !SOCKET_NAME_PATTERN.test(path.basename(normalized))) {
    throw new Error("Runtime mediator socket path is outside the supervisor-owned root.");
  }
  return normalized;
}

export function runtimeMediatorHostSocketPath(socketToken: string): string {
  if (!/^[a-f0-9]{64}$/.test(socketToken)) {
    throw new Error("Runtime mediator socket token is invalid.");
  }
  return `${RUNTIME_MEDIATOR_HOST_SOCKET_ROOT}/${socketToken}.sock`;
}

export interface RuntimeMediatorUnixServerDependencies {
  socketPath: string;
  run(request: RuntimeMediatorRunRequest): Promise<unknown>;
}

export function createRuntimeMediatorUnixServer(
  dependencies: RuntimeMediatorUnixServerDependencies,
) {
  const socketPath = safeSocketPath(dependencies.socketPath);
  let server: Server | null = null;

  async function start(): Promise<void> {
    if (server) throw new Error("Runtime mediator Unix server is already started.");
    await mkdir(RUNTIME_MEDIATOR_HOST_SOCKET_ROOT, { recursive: true, mode: 0o700 });
    await unlink(socketPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });

    const nextServer = createServer((socket) => {
      const decoder = createRuntimeMediatorFrameDecoder(RUNTIME_MEDIATOR_REQUEST_MAX_BYTES, "request");
      let handled = false;

      socket.on("data", (chunk) => {
        if (handled) {
          socket.destroy();
          return;
        }
        let values: unknown[];
        try {
          values = decoder.push(chunk);
        } catch {
          socket.destroy();
          return;
        }
        if (values.length === 0) return;
        if (values.length !== 1) {
          socket.destroy();
          return;
        }
        handled = true;
        void dependencies.run(values[0] as RuntimeMediatorRunRequest)
          .then((response) => {
            try {
              socket.end(encodeRuntimeMediatorFrame(response, RUNTIME_MEDIATOR_RESPONSE_MAX_BYTES));
            } catch {
              socket.destroy();
            }
          })
          .catch(() => socket.destroy());
      });
    });

    await new Promise<void>((resolve, reject) => {
      const fail = (error: Error) => reject(error);
      nextServer.once("error", fail);
      nextServer.listen(socketPath, () => {
        nextServer.off("error", fail);
        resolve();
      });
    });
    await chmod(socketPath, 0o600);
    server = nextServer;
  }

  async function close(): Promise<void> {
    const active = server;
    server = null;
    if (active) {
      await new Promise<void>((resolve, reject) => {
        active.close((error) => error ? reject(error) : resolve());
      });
    }
    await unlink(socketPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }

  return Object.freeze({ start, close, socketPath });
}
