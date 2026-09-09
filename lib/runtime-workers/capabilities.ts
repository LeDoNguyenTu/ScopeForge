export interface RuntimeWorkerCapabilities {
  passiveRuntime: boolean;
  activeCors: boolean;
}

type RuntimeWorkerEnvironment = Readonly<Record<string, string | undefined>>;

function exactTrue(value: string | undefined): boolean {
  return value === "true";
}

export function readRuntimeWorkerCapabilities(
  environment: RuntimeWorkerEnvironment = process.env,
): RuntimeWorkerCapabilities {
  return Object.freeze({
    passiveRuntime: exactTrue(environment.HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED),
    activeCors: exactTrue(environment.HOSTED_ACTIVE_CORS_WORKER_ENABLED),
  });
}
