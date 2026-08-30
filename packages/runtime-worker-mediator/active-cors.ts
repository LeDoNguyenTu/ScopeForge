import {
  validateCorsOriginPolicy,
  type ActiveValidationBudget,
  type AuthorizedValidationTarget,
} from "@/packages/runtime-validator";
import type {
  RuntimeValidationTransport,
  RuntimeValidatorDependencies,
} from "@/packages/runtime-validator/validate";
import { validateRuntimeMediatorResult } from "./validation";
import type { RuntimeMediatorActiveCorsResult } from "./contracts";

export interface ActiveCorsMediatorProfile {
  executionClass: "active_cors_validation_v1";
  target: AuthorizedValidationTarget;
  budget: Readonly<ActiveValidationBudget>;
}

export interface ActiveCorsMediatorDependencies {
  transport?: RuntimeValidationTransport;
  isCancelled?: RuntimeValidatorDependencies["isCancelled"];
  now?: RuntimeValidatorDependencies["now"];
}

export type ActiveCorsMediatorFailureCode =
  | "ACTIVE_CORS_REQUEST_TIMEOUT"
  | "ACTIVE_CORS_TOTAL_TIMEOUT"
  | "ACTIVE_CORS_NETWORK_ERROR"
  | "ACTIVE_CORS_OBSERVATION_BUDGET";

export type ActiveCorsMediatorExecution =
  | Readonly<{ status: "succeeded"; result: RuntimeMediatorActiveCorsResult }>
  | Readonly<{ status: "cancelled"; requestCount: 0 | 1 }>
  | Readonly<{
      status: "failed";
      failureCode: ActiveCorsMediatorFailureCode;
      requestCount: 0 | 1;
    }>;

function mapFailureCode(code: "REQUEST_TIMEOUT" | "TOTAL_TIMEOUT" | "NETWORK_ERROR" | "OBSERVATION_BUDGET" | undefined): ActiveCorsMediatorFailureCode {
  switch (code) {
    case "REQUEST_TIMEOUT":
      return "ACTIVE_CORS_REQUEST_TIMEOUT";
    case "TOTAL_TIMEOUT":
      return "ACTIVE_CORS_TOTAL_TIMEOUT";
    case "OBSERVATION_BUDGET":
      return "ACTIVE_CORS_OBSERVATION_BUDGET";
    case "NETWORK_ERROR":
    default:
      return "ACTIVE_CORS_NETWORK_ERROR";
  }
}

export async function executeActiveCorsProfile(
  profile: ActiveCorsMediatorProfile,
  dependencies: ActiveCorsMediatorDependencies = {},
): Promise<ActiveCorsMediatorExecution> {
  const validation = await validateCorsOriginPolicy(profile.target, profile.budget, {
    ...(dependencies.transport ? { transport: dependencies.transport } : {}),
    ...(dependencies.isCancelled ? { isCancelled: dependencies.isCancelled } : {}),
    ...(dependencies.now ? { now: dependencies.now } : {}),
  });

  if (validation.status === "cancelled") {
    return Object.freeze({
      status: "cancelled" as const,
      requestCount: validation.requestCount,
    });
  }
  if (validation.status === "failed") {
    return Object.freeze({
      status: "failed" as const,
      failureCode: mapFailureCode(validation.failureCode),
      requestCount: validation.requestCount,
    });
  }
  if (!validation.observation) {
    return Object.freeze({
      status: "failed" as const,
      failureCode: "ACTIVE_CORS_NETWORK_ERROR" as const,
      requestCount: validation.requestCount,
    });
  }

  const result = validateRuntimeMediatorResult({
    kind: "active_cors_validation",
    requestCount: 1,
    observation: validation.observation,
  }, "active_cors_validation_v1") as RuntimeMediatorActiveCorsResult;

  return Object.freeze({ status: "succeeded" as const, result });
}
