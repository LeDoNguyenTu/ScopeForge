import type {
  AnyWorkerTerminalEnvelope,
  AnyWorkerTerminalExpectation,
  PrivateRepositorySnapshotExecutionClass,
  PrivateRepositorySnapshotInput,
  PrivateRepositorySnapshotTerminalEnvelope,
  PrivateRepositorySnapshotTerminalExpectation,
  WorkerExecutionClass,
  WorkerTaskInput,
  WorkerTerminalEnvelope,
  WorkerTerminalExpectation,
} from "./types";
import { validatePrivateRepositorySnapshotInput } from "./private-repository-validation";
import { validatePrivateRepositorySnapshotTerminalEnvelope } from "./private-repository-terminal-validation";
import {
  validateWorkerTaskInput as validateBaseWorkerTaskInput,
  validateWorkerTerminalEnvelope as validateBaseTerminalEnvelope,
} from "./validation";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateWorkerTaskInput(
  value: unknown,
  executionClass: PrivateRepositorySnapshotExecutionClass,
): PrivateRepositorySnapshotInput;
export function validateWorkerTaskInput(
  value: unknown,
  executionClass: WorkerExecutionClass,
): WorkerTaskInput;
export function validateWorkerTaskInput(
  value: unknown,
  executionClass: WorkerExecutionClass | PrivateRepositorySnapshotExecutionClass,
): WorkerTaskInput | PrivateRepositorySnapshotInput {
  if (executionClass === "repository_snapshot_github_private_v1") {
    return validatePrivateRepositorySnapshotInput(value);
  }
  return validateBaseWorkerTaskInput(value, executionClass);
}

export function validateWorkerTerminalEnvelope(
  value: unknown,
  expectation: PrivateRepositorySnapshotTerminalExpectation,
): PrivateRepositorySnapshotTerminalEnvelope;
export function validateWorkerTerminalEnvelope(
  value: unknown,
  expectation: WorkerTerminalExpectation,
): WorkerTerminalEnvelope;
export function validateWorkerTerminalEnvelope(
  value: unknown,
  expectation: AnyWorkerTerminalExpectation,
): AnyWorkerTerminalEnvelope {
  if (expectation.executionClass === "repository_snapshot_github_private_v1") {
    return validatePrivateRepositorySnapshotTerminalEnvelope(value, expectation);
  }

  if (!isRecord(value) || value.outcome !== "cancelled") {
    return validateBaseTerminalEnvelope(value, expectation);
  }

  if (value.failureCode !== null) {
    throw new Error("Cancelled worker attempts cannot carry a failure code.");
  }
  if (value.result !== null) {
    throw new Error("Cancelled worker attempts cannot return a result payload.");
  }

  const validated = validateBaseTerminalEnvelope({
    ...value,
    outcome: "failed",
    failureCode: "WORKER_EXECUTION_FAILED",
  }, expectation);

  return Object.freeze({
    ...validated,
    outcome: "cancelled" as const,
    failureCode: null,
    result: null,
  });
}
