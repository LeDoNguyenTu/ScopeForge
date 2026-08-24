import {
  requestPinnedHttps,
  type RuntimeNetworkResponse,
  type TrustedRuntimeRequestPlan,
} from "@/packages/runtime-network";
import { validateActiveValidationBudget } from "./budget";
import { buildCorsOriginPolicyRequestPlan } from "./cors-profile";
import { buildCorsPolicyObservation } from "./observations";
import type {
  ActiveValidationBudget,
  AuthorizedValidationTarget,
  CorsOriginPolicyValidationResult,
} from "./contracts";

export type RuntimeValidationTransport = (
  plan: TrustedRuntimeRequestPlan,
) => Promise<RuntimeNetworkResponse>;

export interface RuntimeValidatorDependencies {
  transport?: RuntimeValidationTransport;
  isCancelled?: () => boolean | Promise<boolean>;
  now?: () => number;
}

function frozenResult(
  input: CorsOriginPolicyValidationResult,
): CorsOriginPolicyValidationResult {
  return Object.freeze(input);
}

function observationBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

export async function validateCorsOriginPolicy(
  target: AuthorizedValidationTarget,
  budgetInput: ActiveValidationBudget,
  dependencies: RuntimeValidatorDependencies = {},
): Promise<CorsOriginPolicyValidationResult> {
  const budget = validateActiveValidationBudget(budgetInput);
  const transport = dependencies.transport ?? requestPinnedHttps;
  const isCancelled = dependencies.isCancelled ?? (() => false);
  const now = dependencies.now ?? Date.now;
  const startedAt = now();

  if (await isCancelled()) {
    return frozenResult({ status: "cancelled", requestCount: 0 });
  }

  const elapsedBeforeRequest = Math.max(0, now() - startedAt);
  if (elapsedBeforeRequest >= budget.totalTimeoutMs) {
    return frozenResult({
      status: "failed",
      requestCount: 0,
      failureCode: "TOTAL_TIMEOUT",
    });
  }

  const requestTimeoutMs = Math.min(
    budget.perRequestTimeoutMs,
    budget.totalTimeoutMs - elapsedBeforeRequest,
  );
  const totalBudgetControlsRequest = requestTimeoutMs < budget.perRequestTimeoutMs;
  const plan = buildCorsOriginPolicyRequestPlan({
    target,
    budget,
    timeoutMs: requestTimeoutMs,
  });

  let response: RuntimeNetworkResponse;
  try {
    response = await transport(plan);
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return frozenResult({
        status: "failed",
        requestCount: 0,
        failureCode: totalBudgetControlsRequest ? "TOTAL_TIMEOUT" : "REQUEST_TIMEOUT",
      });
    }
    return frozenResult({
      status: "failed",
      requestCount: 0,
      failureCode: "NETWORK_ERROR",
    });
  }

  if (await isCancelled()) {
    return frozenResult({ status: "cancelled", requestCount: 1 });
  }
  if (now() - startedAt >= budget.totalTimeoutMs) {
    return frozenResult({
      status: "failed",
      requestCount: 1,
      failureCode: "TOTAL_TIMEOUT",
    });
  }

  const observation = buildCorsPolicyObservation({
    url: plan.url,
    response,
  });
  if (observationBytes(observation) > budget.maxObservationBytes) {
    return frozenResult({
      status: "failed",
      requestCount: 1,
      failureCode: "OBSERVATION_BUDGET",
    });
  }

  return frozenResult({
    status: "succeeded",
    requestCount: 1,
    observation,
  });
}
