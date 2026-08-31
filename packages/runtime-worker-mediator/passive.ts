import {
  observeRuntimeTarget,
  type AuthorizedRuntimeTarget,
  type RuntimeObservationBudget,
} from "@/packages/runtime-observer";
import type {
  RuntimeObserverDependencies,
  RuntimeObservationFailureCode,
  RuntimeTransport,
} from "@/packages/runtime-observer/observe";
import { validateRuntimeMediatorResult } from "./validation";
import type { RuntimeMediatorPassiveResult } from "./contracts";

export interface PassiveRuntimeMediatorProfile {
  executionClass: "passive_runtime_observation_v1";
  target: AuthorizedRuntimeTarget;
  budget: Readonly<RuntimeObservationBudget>;
}

export interface PassiveRuntimeMediatorDependencies {
  transport?: RuntimeTransport;
  isCancelled?: RuntimeObserverDependencies["isCancelled"];
  now?: RuntimeObserverDependencies["now"];
  signal?: RuntimeObserverDependencies["signal"];
}

export type PassiveRuntimeMediatorFailureCode =
  | "PASSIVE_RUNTIME_REQUEST_TIMEOUT"
  | "PASSIVE_RUNTIME_TOTAL_TIMEOUT"
  | "PASSIVE_RUNTIME_NETWORK_ERROR"
  | "PASSIVE_RUNTIME_OBSERVATION_BUDGET";

export type PassiveRuntimeMediatorExecution =
  | Readonly<{ status: "succeeded"; result: RuntimeMediatorPassiveResult }>
  | Readonly<{ status: "cancelled"; requestCount: number; redirectCount: number }>
  | Readonly<{
      status: "failed";
      failureCode: PassiveRuntimeMediatorFailureCode;
      requestCount: number;
      redirectCount: number;
    }>;

function mapFailureCode(code: RuntimeObservationFailureCode | undefined): PassiveRuntimeMediatorFailureCode {
  switch (code) {
    case "REQUEST_TIMEOUT":
      return "PASSIVE_RUNTIME_REQUEST_TIMEOUT";
    case "TOTAL_TIMEOUT":
      return "PASSIVE_RUNTIME_TOTAL_TIMEOUT";
    case "OBSERVATION_BUDGET":
      return "PASSIVE_RUNTIME_OBSERVATION_BUDGET";
    case "NETWORK_ERROR":
    default:
      return "PASSIVE_RUNTIME_NETWORK_ERROR";
  }
}

export async function executePassiveRuntimeProfile(
  profile: PassiveRuntimeMediatorProfile,
  dependencies: PassiveRuntimeMediatorDependencies = {},
): Promise<PassiveRuntimeMediatorExecution> {
  const observation = await observeRuntimeTarget(profile.target, profile.budget, {
    ...(dependencies.transport ? { transport: dependencies.transport } : {}),
    ...(dependencies.isCancelled ? { isCancelled: dependencies.isCancelled } : {}),
    ...(dependencies.now ? { now: dependencies.now } : {}),
    ...(dependencies.signal ? { signal: dependencies.signal } : {}),
  });

  if (observation.status === "cancelled") {
    return Object.freeze({
      status: "cancelled" as const,
      requestCount: observation.requestCount,
      redirectCount: observation.redirectCount,
    });
  }
  if (observation.status === "failed") {
    return Object.freeze({
      status: "failed" as const,
      failureCode: mapFailureCode(observation.failureCode),
      requestCount: observation.requestCount,
      redirectCount: observation.redirectCount,
    });
  }

  const result = validateRuntimeMediatorResult({
    kind: "passive_runtime_observation",
    requestCount: observation.requestCount,
    redirectCount: observation.redirectCount,
    observations: observation.observations,
  }, "passive_runtime_observation_v1") as RuntimeMediatorPassiveResult;

  return Object.freeze({ status: "succeeded" as const, result });
}
