import {
  ACTIVE_RUNTIME_USER_AGENT,
  requestPinnedHttps,
  type RuntimeNetworkResponse,
} from "@/packages/runtime-network";
import {
  validateInitialRuntimeUrl,
  validateRedirectTarget,
  type AuthorizedRuntimeTarget,
} from "@/packages/runtime-observer";
import type {
  RuntimeMediatorHttpDiscoveryRecord,
  RuntimeMediatorHttpDiscoveryResult,
} from "./contracts";

export type HttpDiscoveryRouteKind = "root" | "security-txt" | "robots" | "sitemap";
export type HttpDiscoveryProfile = "root-only" | "well-known-safe";
export type HttpDiscoveryMethodProfile = "HEAD_THEN_GET" | "GET_ONLY";
export type HttpDiscoveryCapabilityId = "web.http.probe.v1" | "web.route.discover.v1";

export interface HttpDiscoveryMediatorBudget {
  maxRequests: number;
  perRequestTimeoutMs: number;
  totalTimeoutMs: number;
}

export interface HttpDiscoveryMediatorProfile {
  executionClass: "phase11_http_discovery_v1";
  target: AuthorizedRuntimeTarget;
  capabilityId: HttpDiscoveryCapabilityId;
  discoveryProfile: HttpDiscoveryProfile;
  methodProfile: HttpDiscoveryMethodProfile;
  followSameOriginRedirects: boolean;
  budget: Readonly<HttpDiscoveryMediatorBudget>;
}

export type HttpDiscoveryMediatorFailureCode =
  | "HTTP_DISCOVERY_REQUEST_BUDGET"
  | "HTTP_DISCOVERY_REQUEST_TIMEOUT"
  | "HTTP_DISCOVERY_TOTAL_TIMEOUT"
  | "HTTP_DISCOVERY_NETWORK_ERROR"
  | "HTTP_DISCOVERY_PROFILE_INVALID";

export type HttpDiscoveryMediatorExecution =
  | Readonly<{ status: "succeeded"; result: RuntimeMediatorHttpDiscoveryResult }>
  | Readonly<{ status: "cancelled"; requestCount: number }>
  | Readonly<{ status: "failed"; failureCode: HttpDiscoveryMediatorFailureCode; requestCount: number }>;

export type HttpDiscoveryTransport = (input: {
  method: "GET" | "HEAD";
  url: URL;
  timeoutMs: number;
  signal?: AbortSignal;
}) => Promise<RuntimeNetworkResponse>;

export interface HttpDiscoveryMediatorDependencies {
  transport?: HttpDiscoveryTransport;
  isCancelled?: () => boolean | Promise<boolean>;
  now?: () => number;
  signal?: AbortSignal;
}

const ROUTES = Object.freeze([
  ["root", "/"],
  ["security-txt", "/.well-known/security.txt"],
  ["robots", "/robots.txt"],
  ["sitemap", "/sitemap.xml"],
] as const);
const MAX_REQUESTS = 12;
const MAX_PER_REQUEST_TIMEOUT_MS = 5_000;
const MAX_TOTAL_TIMEOUT_MS = 30_000;
const CONTENT_TYPE_MAX_LENGTH = 160;

const defaultTransport: HttpDiscoveryTransport = (input) => requestPinnedHttps({
  method: input.method,
  url: input.url,
  timeoutMs: input.timeoutMs,
  headers: {
    accept: "*/*",
    "user-agent": ACTIVE_RUNTIME_USER_AGENT,
  },
}, input.signal ? { signal: input.signal } : {});

function failure(
  failureCode: HttpDiscoveryMediatorFailureCode,
  requestCount: number,
): HttpDiscoveryMediatorExecution {
  return Object.freeze({ status: "failed" as const, failureCode, requestCount });
}

function isAbort(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error
    && (error as { name?: unknown }).name === "AbortError";
}

function isTimeout(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error
    && (error as { name?: unknown }).name === "TimeoutError";
}

function firstHeader(
  headers: RuntimeNetworkResponse["headers"],
  name: string,
): string | undefined {
  const value = headers[name.toLowerCase()];
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first : undefined;
}

function boundedContentType(response: RuntimeNetworkResponse): string | undefined {
  const raw = firstHeader(response.headers, "content-type")?.trim();
  if (!raw || raw.length > CONTENT_TYPE_MAX_LENGTH || /[\r\n\0]/.test(raw)) return undefined;
  return raw;
}

function requiredRequestCapacity(profile: HttpDiscoveryMediatorProfile): number {
  const routes = profile.discoveryProfile === "root-only" ? 1 : 4;
  const perRoute = (profile.methodProfile === "HEAD_THEN_GET" ? 2 : 1)
    + (profile.followSameOriginRedirects ? 1 : 0);
  return routes * perRoute;
}

function validProfile(profile: HttpDiscoveryMediatorProfile): boolean {
  if (profile.executionClass !== "phase11_http_discovery_v1") return false;
  if (profile.capabilityId !== "web.http.probe.v1" && profile.capabilityId !== "web.route.discover.v1") return false;
  if (profile.discoveryProfile !== "root-only" && profile.discoveryProfile !== "well-known-safe") return false;
  if (profile.capabilityId === "web.http.probe.v1" && profile.discoveryProfile !== "root-only") return false;
  if (profile.methodProfile !== "HEAD_THEN_GET" && profile.methodProfile !== "GET_ONLY") return false;
  if (typeof profile.followSameOriginRedirects !== "boolean") return false;
  const { maxRequests, perRequestTimeoutMs, totalTimeoutMs } = profile.budget;
  return Number.isInteger(maxRequests) && maxRequests >= 1 && maxRequests <= MAX_REQUESTS
    && Number.isInteger(perRequestTimeoutMs) && perRequestTimeoutMs >= 1 && perRequestTimeoutMs <= MAX_PER_REQUEST_TIMEOUT_MS
    && Number.isInteger(totalTimeoutMs) && totalTimeoutMs >= 1 && totalTimeoutMs <= MAX_TOTAL_TIMEOUT_MS;
}

function routeUrl(base: URL, pathname: string): URL {
  const next = new URL(base.toString());
  next.pathname = pathname;
  next.search = "";
  next.hash = "";
  return next;
}

export async function executeHttpDiscoveryProfile(
  profile: HttpDiscoveryMediatorProfile,
  dependencies: HttpDiscoveryMediatorDependencies = {},
): Promise<HttpDiscoveryMediatorExecution> {
  if (!validProfile(profile)) return failure("HTTP_DISCOVERY_PROFILE_INVALID", 0);
  if (profile.budget.maxRequests < requiredRequestCapacity(profile)) {
    return failure("HTTP_DISCOVERY_REQUEST_BUDGET", 0);
  }

  const base = validateInitialRuntimeUrl(profile.target);
  const routes = profile.discoveryProfile === "root-only" ? ROUTES.slice(0, 1) : ROUTES;
  const transport = dependencies.transport ?? defaultTransport;
  const isCancelled = dependencies.isCancelled ?? (() => false);
  const now = dependencies.now ?? Date.now;
  const signal = dependencies.signal;
  const startedAt = now();
  let requestCount = 0;
  const records: RuntimeMediatorHttpDiscoveryRecord[] = [];

  const cancellationRequested = async () => signal?.aborted === true || await isCancelled();

  const send = async (method: "GET" | "HEAD", url: URL): Promise<
    | { ok: true; response: RuntimeNetworkResponse }
    | { ok: false; execution: HttpDiscoveryMediatorExecution }
  > => {
    if (await cancellationRequested()) {
      return { ok: false, execution: Object.freeze({ status: "cancelled" as const, requestCount }) };
    }
    const elapsed = Math.max(0, now() - startedAt);
    if (elapsed >= profile.budget.totalTimeoutMs) {
      return { ok: false, execution: failure("HTTP_DISCOVERY_TOTAL_TIMEOUT", requestCount) };
    }
    if (requestCount >= profile.budget.maxRequests) {
      return { ok: false, execution: failure("HTTP_DISCOVERY_REQUEST_BUDGET", requestCount) };
    }
    const timeoutMs = Math.min(
      profile.budget.perRequestTimeoutMs,
      profile.budget.totalTimeoutMs - elapsed,
    );
    requestCount += 1;
    try {
      const response = await transport({
        method,
        url,
        timeoutMs,
        ...(signal ? { signal } : {}),
      });
      return { ok: true, response };
    } catch (error) {
      if (isAbort(error) && await cancellationRequested()) {
        return { ok: false, execution: Object.freeze({ status: "cancelled" as const, requestCount }) };
      }
      if (isTimeout(error)) {
        const totalElapsed = Math.max(0, now() - startedAt);
        return {
          ok: false,
          execution: failure(
            totalElapsed >= profile.budget.totalTimeoutMs
              ? "HTTP_DISCOVERY_TOTAL_TIMEOUT"
              : "HTTP_DISCOVERY_REQUEST_TIMEOUT",
            requestCount,
          ),
        };
      }
      return { ok: false, execution: failure("HTTP_DISCOVERY_NETWORK_ERROR", requestCount) };
    }
  };

  for (const [routeKind, pathname] of routes) {
    const initialUrl = routeUrl(base, pathname);
    let method: "GET" | "HEAD" = profile.methodProfile === "HEAD_THEN_GET" ? "HEAD" : "GET";
    let currentUrl = initialUrl;
    let attempted = await send(method, currentUrl);
    if (!attempted.ok) return attempted.execution;

    if (method === "HEAD" && (attempted.response.status === 405 || attempted.response.status === 501)) {
      method = "GET";
      attempted = await send(method, currentUrl);
      if (!attempted.ok) return attempted.execution;
    }

    let response = attempted.response;
    let redirected = false;
    let redirectBlockedReason: RuntimeMediatorHttpDiscoveryRecord["redirectBlockedReason"];
    const location = firstHeader(response.headers, "location");

    if (profile.followSameOriginRedirects
        && response.status >= 300 && response.status < 400
        && location) {
      const decision = validateRedirectTarget(currentUrl, location, profile.target);
      if (!decision.allowed) {
        redirectBlockedReason = decision.reason;
      } else {
        redirected = true;
        currentUrl = decision.url;
        let followed = await send(method, currentUrl);
        if (!followed.ok) return followed.execution;
        if (method === "HEAD" && (followed.response.status === 405 || followed.response.status === 501)) {
          method = "GET";
          followed = await send(method, currentUrl);
          if (!followed.ok) return followed.execution;
        }
        response = followed.response;
      }
    }

    records.push(Object.freeze({
      routeKind,
      status: response.status,
      ...(boundedContentType(response) ? { contentType: boundedContentType(response) } : {}),
      redirected,
      ...(redirectBlockedReason ? { redirectBlockedReason } : {}),
    }));

    if (await cancellationRequested()) {
      return Object.freeze({ status: "cancelled" as const, requestCount });
    }
  }

  return Object.freeze({
    status: "succeeded" as const,
    result: Object.freeze({
      kind: "phase11_http_discovery" as const,
      requestCount,
      records: Object.freeze(records),
    }),
  });
}
