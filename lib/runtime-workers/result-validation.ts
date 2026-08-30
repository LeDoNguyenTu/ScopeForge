import {
  validateWorkerTerminalEnvelope,
  type WorkerTerminalEnvelope,
} from "@/packages/worker-contracts";
import type { RuntimeWorkerExecutionClass } from "./types";

export interface RuntimeWorkerTerminalExpectation {
  taskId: string;
  attemptId: string;
  executionClass: RuntimeWorkerExecutionClass;
}

export function validateRuntimeWorkerTerminal(
  value: unknown,
  expected: RuntimeWorkerTerminalExpectation,
): WorkerTerminalEnvelope {
  const terminal = validateWorkerTerminalEnvelope(value, expected);
  if (terminal.executionClass !== "passive_runtime_observation_v1"
      && terminal.executionClass !== "active_cors_validation_v1") {
    throw new Error("Phase 6D terminal execution class is invalid.");
  }
  if (terminal.outcome === "succeeded") {
    if (terminal.executionClass === "passive_runtime_observation_v1"
        && terminal.result?.kind !== "passive_runtime_observation") {
      throw new Error("Passive runtime success requires normalized observations.");
    }
    if (terminal.executionClass === "active_cors_validation_v1"
        && (terminal.result?.kind !== "active_cors_validation"
          || terminal.result.requestCount !== 1
          || terminal.result.observation?.kind !== "cors-policy")) {
      throw new Error("Active CORS success requires exactly one normalized CORS observation.");
    }
  }
  return terminal;
}
