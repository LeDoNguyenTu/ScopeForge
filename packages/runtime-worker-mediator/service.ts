import type { RuntimeMediatorRunRequest } from "./contracts";
import {
  executeActiveCorsProfile,
  type ActiveCorsMediatorDependencies,
  type ActiveCorsMediatorExecution,
  type ActiveCorsMediatorProfile,
} from "./active-cors";
import {
  executePassiveRuntimeProfile,
  type PassiveRuntimeMediatorDependencies,
  type PassiveRuntimeMediatorExecution,
  type PassiveRuntimeMediatorProfile,
} from "./passive";

export type RuntimeMediatorPreparedProfile =
  | PassiveRuntimeMediatorProfile
  | ActiveCorsMediatorProfile;

export interface RuntimeMediatorProfileRegistry {
  consume(request: RuntimeMediatorRunRequest, now: Date): RuntimeMediatorPreparedProfile;
}

export interface RuntimeMediatorServiceDependencies {
  registry: RuntimeMediatorProfileRegistry;
  passive?: PassiveRuntimeMediatorDependencies;
  activeCors?: ActiveCorsMediatorDependencies;
  now?: () => Date;
}

export type RuntimeMediatorExecution =
  | PassiveRuntimeMediatorExecution
  | ActiveCorsMediatorExecution;

export function createRuntimeMediatorService(
  dependencies: RuntimeMediatorServiceDependencies,
) {
  const now = dependencies.now ?? (() => new Date());

  async function run(request: RuntimeMediatorRunRequest): Promise<RuntimeMediatorExecution> {
    const profile = dependencies.registry.consume(request, now());
    if (profile.executionClass === "passive_runtime_observation_v1") {
      return executePassiveRuntimeProfile(profile, dependencies.passive);
    }
    return executeActiveCorsProfile(profile, dependencies.activeCors);
  }

  return Object.freeze({ run });
}
