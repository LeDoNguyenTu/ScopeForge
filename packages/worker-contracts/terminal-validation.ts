import type {
  WorkerTerminalEnvelope,
  WorkerTerminalExpectation,
} from "./types";
import {
  validateWorkerTaskInput,
  validateWorkerTerminalEnvelope as validateBaseTerminalEnvelope,
} from "./validation";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export { validateWorkerTaskInput };

export function validateWorkerTerminalEnvelope(
  value: unknown,
  expectation: WorkerTerminalExpectation,
): WorkerTerminalEnvelope {
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
