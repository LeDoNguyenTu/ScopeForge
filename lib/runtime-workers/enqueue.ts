import type { RuntimeWorkerCapabilities } from "./capabilities";
import { RuntimeWorkerError } from "./errors";

export type RuntimeWorkerExecutionClass =
  | "passive_runtime_observation_v1"
  | "active_cors_validation_v1";

export type RuntimeWorkerDomainJob = Readonly<{
  workspaceId: string;
  scanJobId: string;
  actorId: string;
  jobKind: "passive_runtime" | "active_validation";
}>;

export type RuntimeWorkerEnqueueInput = Readonly<{
  executionClass: RuntimeWorkerExecutionClass;
  domainJob: RuntimeWorkerDomainJob;
}>;

export interface RuntimeWorkerEnqueueResult {
  scanJobId: string;
  taskId: string;
  executionClass: RuntimeWorkerExecutionClass;
  absoluteDeadlineAt: string;
}

interface WorkerControlEnqueuePort {
  enqueuePassiveRuntimeTask(input: {
    workspaceId: string;
    scanJobId: string;
    actorId: string;
  }): Promise<RuntimeWorkerEnqueueResult>;
  enqueueActiveCorsTask(input: {
    workspaceId: string;
    scanJobId: string;
    actorId: string;
  }): Promise<RuntimeWorkerEnqueueResult>;
}

export interface RuntimeWorkerEnqueueDependencies {
  capabilities: RuntimeWorkerCapabilities;
  workerControl: WorkerControlEnqueuePort;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INPUT_KEYS = Object.freeze(["domainJob", "executionClass"]);
const DOMAIN_JOB_KEYS = Object.freeze(["actorId", "jobKind", "scanJobId", "workspaceId"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function validIdentity(value: unknown): value is RuntimeWorkerDomainJob {
  if (!isRecord(value) || !exactKeys(value, DOMAIN_JOB_KEYS)) return false;
  return UUID_PATTERN.test(String(value.workspaceId))
    && UUID_PATTERN.test(String(value.scanJobId))
    && UUID_PATTERN.test(String(value.actorId))
    && (value.jobKind === "passive_runtime" || value.jobKind === "active_validation");
}

function validatedInput(value: unknown): RuntimeWorkerEnqueueInput {
  if (!isRecord(value) || !exactKeys(value, INPUT_KEYS) || !validIdentity(value.domainJob)) {
    throw new RuntimeWorkerError("RUNTIME_WORKER_TASK_INVALID");
  }
  if (
    value.executionClass !== "passive_runtime_observation_v1"
    && value.executionClass !== "active_cors_validation_v1"
  ) {
    throw new RuntimeWorkerError("RUNTIME_WORKER_TASK_INVALID");
  }
  return value as RuntimeWorkerEnqueueInput;
}

function assertPairing(input: RuntimeWorkerEnqueueInput): void {
  const valid = input.executionClass === "passive_runtime_observation_v1"
    ? input.domainJob.jobKind === "passive_runtime"
    : input.domainJob.jobKind === "active_validation";
  if (!valid) throw new RuntimeWorkerError("RUNTIME_WORKER_TASK_INVALID");
}

function mapEnqueueError(error: unknown): never {
  const code = isRecord(error) && typeof error.code === "string" ? error.code : "";
  const message = error instanceof Error ? error.message : "";
  if (code === "RUNTIME_WORKER_ACTIVE_LIMIT" || message.includes("RUNTIME_WORKER_ACTIVE_LIMIT")) {
    throw new RuntimeWorkerError("RUNTIME_WORKER_BUSY");
  }
  throw new RuntimeWorkerError("RUNTIME_WORKER_TASK_INVALID");
}

export async function enqueueRuntimeWorkerTask(
  rawInput: RuntimeWorkerEnqueueInput,
  dependencies: RuntimeWorkerEnqueueDependencies,
): Promise<RuntimeWorkerEnqueueResult> {
  const input = validatedInput(rawInput);
  assertPairing(input);

  if (input.executionClass === "passive_runtime_observation_v1") {
    if (!dependencies.capabilities.passiveRuntime) {
      throw new RuntimeWorkerError("RUNTIME_WORKER_UNAVAILABLE");
    }
    try {
      return await dependencies.workerControl.enqueuePassiveRuntimeTask({
        workspaceId: input.domainJob.workspaceId,
        scanJobId: input.domainJob.scanJobId,
        actorId: input.domainJob.actorId,
      });
    } catch (error) {
      return mapEnqueueError(error);
    }
  }

  if (!dependencies.capabilities.activeCors) {
    throw new RuntimeWorkerError("RUNTIME_WORKER_UNAVAILABLE");
  }
  try {
    return await dependencies.workerControl.enqueueActiveCorsTask({
      workspaceId: input.domainJob.workspaceId,
      scanJobId: input.domainJob.scanJobId,
      actorId: input.domainJob.actorId,
    });
  } catch (error) {
    return mapEnqueueError(error);
  }
}
