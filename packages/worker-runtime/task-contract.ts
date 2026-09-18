import {
  validateWorkerTaskInput,
  workerExecutionProfile,
  type AnyWorkerTaskContract,
  type PrivateRepositorySnapshotExecutionClass,
  type WorkerExecutionClass,
  type WorkerExecutionBudget,
} from "@/packages/worker-contracts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TOKEN = /^[a-f0-9]{64}$/;
const CLASSES = new Set<string>([
  "foundation_no_egress_v1",
  "repository_snapshot_github_public_v1",
  "repository_snapshot_github_private_v1",
  "phase3_repository_scan_no_egress_v1",
  "passive_runtime_observation_v1",
  "active_cors_validation_v1",
  "phase11_http_discovery_v1",
]);
const KEYS = ["taskId", "attemptId", "executionClass", "leaseToken", "absoluteDeadlineAt", "budget", "input"];

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} is invalid.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const allowed = new Set(keys);
  if (Object.keys(value).length !== keys.length || Object.keys(value).some((key) => !allowed.has(key))) {
    throw new Error(`${label} is invalid.`);
  }
}

function executionClass(value: unknown): WorkerExecutionClass | PrivateRepositorySnapshotExecutionClass {
  if (typeof value !== "string" || !CLASSES.has(value)) throw new Error("Worker task execution class is invalid.");
  return value as WorkerExecutionClass | PrivateRepositorySnapshotExecutionClass;
}

function budget(value: unknown, expected: WorkerExecutionBudget): WorkerExecutionBudget {
  const candidate = record(value, "Worker task budget");
  const keys = Object.keys(expected) as Array<keyof WorkerExecutionBudget>;
  exactKeys(candidate, keys, "Worker task budget");
  for (const key of keys) {
    if (candidate[key] !== expected[key]) throw new Error("Worker task budget is invalid.");
  }
  return Object.freeze({ ...expected });
}

export function validateWorkerTaskContract(
  value: unknown,
  expectedExecutionClass?: WorkerExecutionClass | PrivateRepositorySnapshotExecutionClass,
): AnyWorkerTaskContract {
  const candidate = record(value, "Worker task response");
  exactKeys(candidate, KEYS, "Worker task response");
  if (typeof candidate.taskId !== "string" || !UUID.test(candidate.taskId)
      || typeof candidate.attemptId !== "string" || !UUID.test(candidate.attemptId)) {
    throw new Error("Worker task identity is invalid.");
  }
  if (typeof candidate.leaseToken !== "string" || !TOKEN.test(candidate.leaseToken)) {
    throw new Error("Worker task lease is invalid.");
  }
  const selectedClass = executionClass(candidate.executionClass);
  if (expectedExecutionClass && selectedClass !== expectedExecutionClass) {
    throw new Error("Worker task execution class does not match this worker.");
  }
  if (typeof candidate.absoluteDeadlineAt !== "string") throw new Error("Worker task deadline is invalid.");
  const deadline = Date.parse(candidate.absoluteDeadlineAt);
  if (!Number.isFinite(deadline)) throw new Error("Worker task deadline is invalid.");
  const profile = selectedClass === "repository_snapshot_github_private_v1"
    ? workerExecutionProfile(selectedClass)
    : workerExecutionProfile(selectedClass);
  const validatedBudget = budget(candidate.budget, profile.budget);
  const input = selectedClass === "repository_snapshot_github_private_v1"
    ? validateWorkerTaskInput(candidate.input, selectedClass)
    : validateWorkerTaskInput(candidate.input, selectedClass);
  return Object.freeze({
    taskId: candidate.taskId,
    attemptId: candidate.attemptId,
    executionClass: selectedClass,
    leaseToken: candidate.leaseToken,
    absoluteDeadlineAt: candidate.absoluteDeadlineAt,
    budget: validatedBudget,
    input,
  }) as AnyWorkerTaskContract;
}
