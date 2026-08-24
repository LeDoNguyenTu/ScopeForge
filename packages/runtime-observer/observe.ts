import type {
  AuthorizedRuntimeTarget,
  RuntimeObservationBudget,
} from "./contracts";
import { validateRuntimeObservationBudget } from "./budget";
import {
  PASSIVE_RUNTIME_USER_AGENT,
  requestPinnedHttps,
  type RuntimeNetworkResponse,
} from "@/packages/runtime-network";
import {
  buildPassiveResponseObservations,
  redactRuntimeObservationUrl,
  type RuntimeObservation,
} from "./observations";
import { getHeaderValues } from "./redaction";
import { validateInitialRuntimeUrl, validateRedirectTarget } from "./target-policy";

export type RuntimeTransport = (input: {
  url: URL;
  timeoutMs: number;
}) => Promise<RuntimeNetworkResponse>;

export type RuntimeObservationFailureCode =
  | "REQUEST_TIMEOUT"
  | "TOTAL_TIMEOUT"
  | "NETWORK_ERROR"
  | "OBSERVATION_BUDGET";

export interface RuntimeObservationResult {
  status: "succeeded" | "cancelled" | "failed";
  observations: readonly RuntimeObservation[];
  requestCount: number;
  redirectCount: number;
  failureCode?: RuntimeObservationFailureCode;
}

export interface RuntimeObserverDependencies {
  transport?: RuntimeTransport;
  isCancelled?: () => boolean | Promise<boolean>;
  now?: () => number;
}

const defaultTransport: RuntimeTransport = (input) => requestPinnedHttps({
  method: "GET",
  url: input.url,
  timeoutMs: input.timeoutMs,
  headers: {
    accept: "*/*",
    "user-agent": PASSIVE_RUNTIME_USER_AGENT,
  },
});

function result(input: RuntimeObservationResult): RuntimeObservationResult {
  return Object.freeze({
    ...input,
    observations: Object.freeze([...input.observations]),
  });
}

function serializedSize(value: readonly RuntimeObservation[]): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function appendWithinBudget(
  target: RuntimeObservation[],
  additions: readonly RuntimeObservation[],
  maximumBytes: number,
): boolean {
  const previousLength = target.length;
  target.push(...additions);
  if (serializedSize(target) <= maximumBytes) return true;
  target.splice(previousLength);
  return false;
}

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400;
}

function redirectHost(current: URL, location: string): string {
  try {
    return new URL(location, current).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function failed(
  observations: readonly RuntimeObservation[],
  requestCount: number,
  redirectCount: number,
  failureCode: RuntimeObservationFailureCode,
): RuntimeObservationResult {
  return result({
    status: "failed",
    observations,
    requestCount,
    redirectCount,
    failureCode,
  });
}

export async function observeRuntimeTarget(
  target: AuthorizedRuntimeTarget,
  budgetInput: RuntimeObservationBudget,
  dependencies: RuntimeObserverDependencies = {},
): Promise<RuntimeObservationResult> {
  const budget = validateRuntimeObservationBudget(budgetInput);
  const transport = dependencies.transport ?? defaultTransport;
  const isCancelled = dependencies.isCancelled ?? (() => false);
  const now = dependencies.now ?? Date.now;
  const startedAt = now();
  const observations: RuntimeObservation[] = [];
  let requestCount = 0;
  let redirectCount = 0;
  let current = validateInitialRuntimeUrl(target);

  while (true) {
    if (await isCancelled()) {
      return result({ status: "cancelled", observations, requestCount, redirectCount });
    }
    const elapsedBeforeRequest = Math.max(0, now() - startedAt);
    if (elapsedBeforeRequest >= budget.totalTimeoutMs) {
      return failed(observations, requestCount, redirectCount, "TOTAL_TIMEOUT");
    }
    if (requestCount >= budget.maxRequests) {
      return result({ status: "succeeded", observations, requestCount, redirectCount });
    }

    const remainingTotalTimeoutMs = budget.totalTimeoutMs - elapsedBeforeRequest;
    const requestTimeoutMs = Math.min(
      budget.perRequestTimeoutMs,
      remainingTotalTimeoutMs,
    );
    const totalBudgetControlsRequestTimeout = requestTimeoutMs < budget.perRequestTimeoutMs;

    let response: RuntimeNetworkResponse;
    try {
      response = await transport({
        url: current,
        timeoutMs: requestTimeoutMs,
      });
      requestCount += 1;
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        return failed(
          observations,
          requestCount,
          redirectCount,
          totalBudgetControlsRequestTimeout ? "TOTAL_TIMEOUT" : "REQUEST_TIMEOUT",
        );
      }
      return failed(observations, requestCount, redirectCount, "NETWORK_ERROR");
    }

    const responseObservations = buildPassiveResponseObservations({
      url: current,
      response,
    });
    if (!appendWithinBudget(observations, responseObservations, budget.maxObservationBytes)) {
      return failed(observations, requestCount, redirectCount, "OBSERVATION_BUDGET");
    }

    if (await isCancelled()) {
      return result({ status: "cancelled", observations, requestCount, redirectCount });
    }
    if (now() - startedAt >= budget.totalTimeoutMs) {
      return failed(observations, requestCount, redirectCount, "TOTAL_TIMEOUT");
    }

    const location = getHeaderValues(response.headers, "location")[0];
    if (!isRedirectStatus(response.status) || !location) {
      return result({ status: "succeeded", observations, requestCount, redirectCount });
    }

    const decision = validateRedirectTarget(current, location, target);
    const toHost = redirectHost(current, location);
    const redactedCurrent = redactRuntimeObservationUrl(current);
    if (!decision.allowed) {
      const redirect: RuntimeObservation = Object.freeze({
        kind: "redirect",
        from: redactedCurrent,
        toHost,
        followed: false,
        reason: decision.reason,
      });
      if (!appendWithinBudget(observations, [redirect], budget.maxObservationBytes)) {
        return failed(observations, requestCount, redirectCount, "OBSERVATION_BUDGET");
      }
      return result({ status: "succeeded", observations, requestCount, redirectCount });
    }

    if (redirectCount >= budget.maxRedirects) {
      const redirect: RuntimeObservation = Object.freeze({
        kind: "redirect",
        from: redactedCurrent,
        toHost,
        followed: false,
        reason: "REDIRECT_LIMIT",
      });
      if (!appendWithinBudget(observations, [redirect], budget.maxObservationBytes)) {
        return failed(observations, requestCount, redirectCount, "OBSERVATION_BUDGET");
      }
      return result({ status: "succeeded", observations, requestCount, redirectCount });
    }

    if (requestCount >= budget.maxRequests) {
      const redirect: RuntimeObservation = Object.freeze({
        kind: "redirect",
        from: redactedCurrent,
        toHost,
        followed: false,
        reason: "REQUEST_LIMIT",
      });
      if (!appendWithinBudget(observations, [redirect], budget.maxObservationBytes)) {
        return failed(observations, requestCount, redirectCount, "OBSERVATION_BUDGET");
      }
      return result({ status: "succeeded", observations, requestCount, redirectCount });
    }

    if (await isCancelled()) {
      return result({ status: "cancelled", observations, requestCount, redirectCount });
    }
    if (now() - startedAt >= budget.totalTimeoutMs) {
      return failed(observations, requestCount, redirectCount, "TOTAL_TIMEOUT");
    }

    const redirect: RuntimeObservation = Object.freeze({
      kind: "redirect",
      from: redactedCurrent,
      toHost,
      followed: true,
    });
    if (!appendWithinBudget(observations, [redirect], budget.maxObservationBytes)) {
      return failed(observations, requestCount, redirectCount, "OBSERVATION_BUDGET");
    }

    redirectCount += 1;
    current = decision.url;
  }
}
