import type { RuntimeMediatorRunRequest } from "./contracts";
import {
  executeHttpDiscoveryProfile,
  type HttpDiscoveryMediatorDependencies,
  type HttpDiscoveryMediatorExecution,
  type HttpDiscoveryMediatorProfile,
} from "./http-discovery";
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
  | ActiveCorsMediatorProfile
  | HttpDiscoveryMediatorProfile;

export interface RuntimeMediatorProfileRegistry {
  consume(request: RuntimeMediatorRunRequest, now: Date): RuntimeMediatorPreparedProfile;
}

export interface RuntimeMediatorServiceDependencies {
  registry: RuntimeMediatorProfileRegistry;
  passive?: PassiveRuntimeMediatorDependencies;
  activeCors?: ActiveCorsMediatorDependencies;
  httpDiscovery?: HttpDiscoveryMediatorDependencies;
  now?: () => Date;
}

export type RuntimeMediatorExecution =
  | PassiveRuntimeMediatorExecution
  | ActiveCorsMediatorExecution
  | HttpDiscoveryMediatorExecution;

export function createRuntimeMediatorService(
  dependencies: RuntimeMediatorServiceDependencies,
) {
  const now = dependencies.now ?? (() => new Date());

  async function run(request: RuntimeMediatorRunRequest): Promise<RuntimeMediatorExecution> {
    const profile = dependencies.registry.consume(request, now());
    if (profile.executionClass === "passive_runtime_observation_v1") {
      return executePassiveRuntimeProfile(profile, dependencies.passive);
    }
    if (profile.executionClass === "active_cors_validation_v1") {
      return executeActiveCorsProfile(profile, dependencies.activeCors);
    }
    return executeHttpDiscoveryProfile(profile, dependencies.httpDiscovery);
  }

  return Object.freeze({ run });
}
