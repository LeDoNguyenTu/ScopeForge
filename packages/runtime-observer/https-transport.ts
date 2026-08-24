import { request as httpsRequest, type RequestOptions } from "node:https";
import { isIP } from "node:net";
import type { TLSSocket } from "node:tls";
import {
  defaultRuntimeResolver,
  resolvePinnedRuntimeAddress,
  type RuntimeResolver,
} from "./dns";

export interface RuntimeTlsMetadata {
  protocol: string | null;
  validFrom: string | null;
  validTo: string | null;
  subjectAltName: string | null;
}

export interface RuntimeTransportResponse {
  status: number;
  headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  tls: RuntimeTlsMetadata;
}

export type RuntimeRequester = (options: RequestOptions) => Promise<RuntimeTransportResponse>;

export interface RuntimeTransportDependencies {
  resolver?: RuntimeResolver;
  requester?: RuntimeRequester;
  now?: () => number;
}

export interface PinnedHttpsRequestInput {
  url: URL;
  address: string;
  family: 4 | 6;
  timeoutMs: number;
}

function assertRuntimeTimeout(timeoutMs: number): void {
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Runtime transport timeout must be a positive integer.");
  }
}

function runtimeTimeoutError(): Error {
  return Object.assign(new Error("Runtime HTTPS request timed out."), {
    name: "TimeoutError",
  });
}

export function buildPinnedHttpsRequestOptions(input: PinnedHttpsRequestInput): RequestOptions {
  if (input.url.protocol !== "https:") {
    throw new Error("Runtime transport requires HTTPS.");
  }
  assertRuntimeTimeout(input.timeoutMs);

  const hostname = input.url.hostname.toLowerCase();
  const port = input.url.port ? Number(input.url.port) : 443;
  if (port !== 443) {
    throw new Error("Runtime transport supports HTTPS port 443 only.");
  }

  return {
    method: "GET",
    agent: false,
    hostname,
    servername: isIP(hostname) ? undefined : hostname,
    port: 443,
    path: `${input.url.pathname}${input.url.search}`,
    timeout: input.timeoutMs,
    headers: {
      accept: "*/*",
      "user-agent": "ScopeForge-RuntimeObserver/0.1",
    },
    lookup: ((_hostname: string, _options: unknown, callback: (
      error: NodeJS.ErrnoException | null,
      address: string,
      family: number,
    ) => void) => {
      callback(null, input.address, input.family);
    }) as RequestOptions["lookup"],
  };
}

function readTlsMetadata(socket: TLSSocket): RuntimeTlsMetadata {
  const certificate = socket.getPeerCertificate();
  return {
    protocol: socket.getProtocol() ?? null,
    validFrom: certificate?.valid_from ?? null,
    validTo: certificate?.valid_to ?? null,
    subjectAltName: certificate?.subjectaltname ?? null,
  };
}

function normalizeHeaders(
  headers: Readonly<Record<string, string | string[] | undefined>>,
): Readonly<Record<string, string | readonly string[] | undefined>> {
  const normalized: Record<string, string | readonly string[] | undefined> = {};
  for (const [name, value] of Object.entries(headers)) {
    normalized[name.toLowerCase()] = Array.isArray(value) ? Object.freeze([...value]) : value;
  }
  return Object.freeze(normalized);
}

export const defaultRuntimeRequester: RuntimeRequester = (options) =>
  new Promise((resolve, reject) => {
    let settled = false;
    const finishReject = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const request = httpsRequest(options, (response) => {
      if (settled) {
        response.destroy();
        return;
      }

      const socket = response.socket as TLSSocket;
      const result: RuntimeTransportResponse = Object.freeze({
        status: response.statusCode ?? 0,
        headers: normalizeHeaders(response.headers),
        tls: Object.freeze(readTlsMetadata(socket)),
      });

      settled = true;
      response.destroy();
      resolve(result);
    });

    request.on("timeout", () => {
      request.destroy(runtimeTimeoutError());
    });
    request.on("error", finishReject);
    request.end();
  });

export async function requestPinnedHttps(
  input: { url: URL; timeoutMs: number },
  dependencies: RuntimeTransportDependencies = {},
): Promise<RuntimeTransportResponse> {
  assertRuntimeTimeout(input.timeoutMs);

  const resolver = dependencies.resolver ?? defaultRuntimeResolver;
  const requester = dependencies.requester ?? defaultRuntimeRequester;
  const now = dependencies.now ?? Date.now;
  const startedAt = now();
  const controller = new AbortController();
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const operation = (async () => {
    const pinned = await resolvePinnedRuntimeAddress(input.url.hostname, resolver);
    const elapsedMs = Math.max(0, now() - startedAt);
    const remainingTimeoutMs = input.timeoutMs - elapsedMs;
    if (expired || remainingTimeoutMs <= 0) {
      throw runtimeTimeoutError();
    }

    const options = buildPinnedHttpsRequestOptions({
      url: input.url,
      timeoutMs: remainingTimeoutMs,
      ...pinned,
    });
    return requester({
      ...options,
      signal: controller.signal,
    });
  })();

  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      expired = true;
      reject(runtimeTimeoutError());
      controller.abort();
    }, input.timeoutMs);
  });

  try {
    return await Promise.race([operation, deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
