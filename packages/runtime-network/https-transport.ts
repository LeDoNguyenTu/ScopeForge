import { request as httpsRequest, type RequestOptions } from "node:https";
import { isIP } from "node:net";
import type { TLSSocket } from "node:tls";
import {
  ACTIVE_RUNTIME_USER_AGENT,
  PASSIVE_RUNTIME_USER_AGENT,
  SCOPEFORGE_SYNTHETIC_ORIGIN,
  type RuntimeNetworkDependencies,
  type RuntimeNetworkResponse,
  type RuntimeRequester,
  type RuntimeTlsMetadata,
  type TrustedRuntimeRequestPlan,
} from "./contracts";
import {
  defaultRuntimeResolver,
  resolvePinnedRuntimeAddress,
} from "./dns";

const TRUSTED_HEADER_NAMES = new Set(["accept", "user-agent", "origin"]);

function assertRuntimeTimeout(timeoutMs: number): void {
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Runtime transport timeout must be a positive integer.");
  }
}

function assertTrustedRuntimeRequestPlan(plan: TrustedRuntimeRequestPlan): void {
  if (plan.method !== "GET") {
    throw new Error("Runtime transport supports GET requests only.");
  }
  if (plan.url.protocol !== "https:") {
    throw new Error("Runtime transport requires HTTPS.");
  }
  if (plan.url.username || plan.url.password) {
    throw new Error("Runtime transport does not allow URL credentials.");
  }
  if (plan.url.hash) {
    throw new Error("Runtime transport does not allow URL fragments.");
  }
  const port = plan.url.port ? Number(plan.url.port) : 443;
  if (port !== 443) {
    throw new Error("Runtime transport supports HTTPS port 443 only.");
  }
  assertRuntimeTimeout(plan.timeoutMs);

  const headers = plan.headers as Readonly<Record<string, string | undefined>>;
  for (const name of Object.keys(headers)) {
    if (!TRUSTED_HEADER_NAMES.has(name.toLowerCase())) {
      throw new Error("Runtime transport received an untrusted header name.");
    }
  }
  if (headers.accept !== "*/*") {
    throw new Error("Runtime transport requires the trusted Accept header.");
  }
  if (
    headers["user-agent"] !== PASSIVE_RUNTIME_USER_AGENT &&
    headers["user-agent"] !== ACTIVE_RUNTIME_USER_AGENT
  ) {
    throw new Error("Runtime transport requires a trusted ScopeForge User-Agent.");
  }
  if (headers.origin !== undefined && headers.origin !== SCOPEFORGE_SYNTHETIC_ORIGIN) {
    throw new Error("Runtime transport rejected an untrusted Origin header.");
  }
}

function runtimeTimeoutError(): Error {
  return Object.assign(new Error("Runtime HTTPS request timed out."), {
    name: "TimeoutError",
  });
}

function runtimeAbortError(): DOMException {
  return new DOMException("Runtime HTTPS request was cancelled.", "AbortError");
}

export function buildPinnedHttpsRequestOptions(input: {
  plan: TrustedRuntimeRequestPlan;
  address: string;
  family: 4 | 6;
}): RequestOptions {
  assertTrustedRuntimeRequestPlan(input.plan);

  const detectedFamily = isIP(input.address);
  if (detectedFamily === 0 || detectedFamily !== input.family) {
    throw new Error("Runtime transport requires a validated pinned IP address.");
  }

  const hostname = input.plan.url.hostname.toLowerCase();
  const headers: Record<string, string> = {
    accept: input.plan.headers.accept,
    "user-agent": input.plan.headers["user-agent"],
  };
  if (input.plan.headers.origin !== undefined) {
    headers.origin = input.plan.headers.origin;
  }

  return {
    method: "GET",
    agent: false,
    hostname,
    servername: isIP(hostname) ? undefined : hostname,
    family: input.family,
    port: 443,
    path: `${input.plan.url.pathname}${input.plan.url.search}`,
    timeout: input.plan.timeoutMs,
    headers,
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
      const result: RuntimeNetworkResponse = Object.freeze({
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
  plan: TrustedRuntimeRequestPlan,
  dependencies: RuntimeNetworkDependencies = {},
): Promise<RuntimeNetworkResponse> {
  assertTrustedRuntimeRequestPlan(plan);

  const resolver = dependencies.resolver ?? defaultRuntimeResolver;
  const requester = dependencies.requester ?? defaultRuntimeRequester;
  const now = dependencies.now ?? Date.now;
  const externalSignal = dependencies.signal;
  if (externalSignal?.aborted) throw runtimeAbortError();

  const startedAt = now();
  const controller = new AbortController();
  let expired = false;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onExternalAbort: (() => void) | undefined;

  const operation = (async () => {
    const pinned = await resolvePinnedRuntimeAddress(plan.url.hostname, resolver);
    const elapsedMs = Math.max(0, now() - startedAt);
    const remainingTimeoutMs = plan.timeoutMs - elapsedMs;
    if (cancelled || externalSignal?.aborted || controller.signal.aborted) {
      if (expired) throw runtimeTimeoutError();
      throw runtimeAbortError();
    }
    if (expired || remainingTimeoutMs <= 0) {
      throw runtimeTimeoutError();
    }

    const options = buildPinnedHttpsRequestOptions({
      plan: {
        ...plan,
        timeoutMs: remainingTimeoutMs,
      },
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
    }, plan.timeoutMs);
  });

  const races: Array<Promise<RuntimeNetworkResponse> | Promise<never>> = [operation, deadline];
  if (externalSignal) {
    races.push(new Promise<never>((_resolve, reject) => {
      onExternalAbort = () => {
        cancelled = true;
        controller.abort();
        reject(runtimeAbortError());
      };
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }));
  }

  try {
    return await Promise.race(races);
  } finally {
    if (timer) clearTimeout(timer);
    if (externalSignal && onExternalAbort) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }
}
