import { createHash } from "node:crypto";
import type { WorkerTerminalEnvelope } from "@/packages/worker-contracts";
import type { WorkerExecutorContract } from "./executor";

function baseMetrics(inputBytes: number, outputBytes: number) {
  return Object.freeze({
    wallTimeMs: 0,
    cpuTimeMs: 0,
    peakMemoryBytes: 0,
    inputBytes,
    outputBytes,
  });
}

function invalidContract(contract: WorkerExecutorContract): WorkerTerminalEnvelope {
  return Object.freeze({
    schemaVersion: 1,
    taskId: contract.taskId,
    attemptId: contract.attemptId,
    executionClass: contract.executionClass,
    outcome: "failed",
    failureCode: "WORKER_OUTPUT_INVALID",
    metrics: baseMetrics(0, 0),
    result: null,
  });
}

export async function executeFoundationProbe(
  contract: WorkerExecutorContract,
  signal: AbortSignal,
): Promise<WorkerTerminalEnvelope> {
  if (
    contract.executionClass !== "foundation_no_egress_v1"
    || contract.input.kind !== "foundation_probe"
  ) {
    return invalidContract(contract);
  }

  if (signal.aborted) {
    return Object.freeze({
      schemaVersion: 1,
      taskId: contract.taskId,
      attemptId: contract.attemptId,
      executionClass: "foundation_no_egress_v1",
      outcome: "cancelled",
      failureCode: null,
      metrics: baseMetrics(0, 0),
      result: null,
    });
  }

  const inputBytes = new TextEncoder().encode(contract.input.nonce).byteLength;
  const nonceDigest = createHash("sha256")
    .update(contract.input.nonce, "utf8")
    .digest("hex");

  if (signal.aborted) {
    return Object.freeze({
      schemaVersion: 1,
      taskId: contract.taskId,
      attemptId: contract.attemptId,
      executionClass: "foundation_no_egress_v1",
      outcome: "cancelled",
      failureCode: null,
      metrics: baseMetrics(inputBytes, 0),
      result: null,
    });
  }

  return Object.freeze({
    schemaVersion: 1,
    taskId: contract.taskId,
    attemptId: contract.attemptId,
    executionClass: "foundation_no_egress_v1",
    outcome: "succeeded",
    failureCode: null,
    metrics: baseMetrics(inputBytes, nonceDigest.length),
    result: Object.freeze({
      kind: "foundation_probe",
      nonceDigest,
    }),
  });
}
