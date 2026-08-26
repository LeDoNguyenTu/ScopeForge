import { workerExecutionProfile } from "./profiles";
import type {
  FoundationProbeResult,
  WorkerAttemptMetrics,
  WorkerTerminalEnvelope,
  WorkerTerminalExpectation,
  WorkerTerminalFailureCode,
  WorkerTerminalOutcome,
} from "./types";

const ENVELOPE_KEYS = [
  "schemaVersion",
  "taskId",
  "attemptId",
  "executionClass",
  "outcome",
  "failureCode",
  "metrics",
  "result",
] as const;
const METRIC_KEYS = [
  "wallTimeMs",
  "cpuTimeMs",
  "peakMemoryBytes",
  "inputBytes",
  "outputBytes",
] as const;
const RESULT_KEYS = ["kind", "nonceDigest"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const OUTCOMES = new Set<WorkerTerminalOutcome>(["succeeded", "failed", "cancelled"]);
const TERMINAL_FAILURE_CODES = new Set<WorkerTerminalFailureCode>([
  "WORKER_LOST",
  "WORKER_BUDGET_EXCEEDED",
  "WORKER_OUTPUT_INVALID",
  "WORKER_EXECUTION_FAILED",
  "WORKER_CLASS_UNAVAILABLE",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  context: string,
): void {
  const allowedSet = new Set(allowed);
  const unexpected = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unexpected.length > 0) {
    throw new Error(`${context} contains unexpected fields: ${unexpected.join(", ")}.`);
  }
  for (const key of allowed) {
    if (!(key in value)) throw new Error(`${context} is missing ${key}.`);
  }
}

function boundedInteger(value: unknown, maximum: number, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  if ((value as number) > maximum) throw new Error(`${label} exceeds the execution budget.`);
  return value as number;
}

function parseMetrics(
  value: unknown,
  executionClass: WorkerTerminalExpectation["executionClass"],
): WorkerAttemptMetrics {
  if (!isRecord(value)) throw new Error("Worker terminal metrics must be an object.");
  assertExactKeys(value, METRIC_KEYS, "Worker terminal metrics");
  const budget = workerExecutionProfile(executionClass).budget;
  return Object.freeze({
    wallTimeMs: boundedInteger(value.wallTimeMs, budget.maxWallTimeMs, "wallTimeMs"),
    cpuTimeMs: boundedInteger(value.cpuTimeMs, budget.maxCpuTimeMs, "cpuTimeMs"),
    peakMemoryBytes: boundedInteger(value.peakMemoryBytes, budget.maxMemoryBytes, "peakMemoryBytes"),
    inputBytes: boundedInteger(value.inputBytes, budget.maxInputBytes, "inputBytes"),
    outputBytes: boundedInteger(value.outputBytes, budget.maxOutputBytes, "outputBytes"),
  });
}

function parseResult(value: unknown, outcome: WorkerTerminalOutcome): FoundationProbeResult | null {
  if (outcome !== "succeeded") {
    if (value !== null) throw new Error("Failed or cancelled worker attempts cannot return a result payload.");
    return null;
  }
  if (!isRecord(value)) throw new Error("Successful worker attempts require a result object.");
  assertExactKeys(value, RESULT_KEYS, "Worker terminal result");
  if (value.kind !== "foundation_probe") {
    throw new Error("Worker terminal result kind is not supported.");
  }
  if (typeof value.nonceDigest !== "string" || !/^[a-f0-9]{64}$/.test(value.nonceDigest)) {
    throw new Error("Worker terminal result nonce digest is invalid.");
  }
  return Object.freeze({ kind: "foundation_probe", nonceDigest: value.nonceDigest });
}

function parseFailureCode(
  value: unknown,
  outcome: WorkerTerminalOutcome,
): WorkerTerminalFailureCode | null {
  if (outcome === "succeeded" || outcome === "cancelled") {
    if (value !== null) {
      throw new Error(`${outcome === "succeeded" ? "Successful" : "Cancelled"} worker attempts cannot include a caller-selected failure code.`);
    }
    return null;
  }
  if (typeof value !== "string" || !TERMINAL_FAILURE_CODES.has(value as WorkerTerminalFailureCode)) {
    throw new Error("Worker failure code is not an allowed terminal failure code.");
  }
  return value as WorkerTerminalFailureCode;
}

function resultBytes(value: FoundationProbeResult | null): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function validateWorkerTerminalEnvelope(
  value: unknown,
  expected: WorkerTerminalExpectation,
): WorkerTerminalEnvelope {
  if (!isRecord(value)) throw new Error("Worker terminal envelope must be an object.");
  assertExactKeys(value, ENVELOPE_KEYS, "Worker terminal envelope");
  if (value.schemaVersion !== 1) throw new Error("Worker terminal schema version is unsupported.");
  if (typeof value.taskId !== "string" || !UUID_PATTERN.test(value.taskId)) {
    throw new Error("Worker terminal task identifier is invalid.");
  }
  if (typeof value.attemptId !== "string" || !UUID_PATTERN.test(value.attemptId)) {
    throw new Error("Worker terminal attempt identifier is invalid.");
  }
  if (value.taskId !== expected.taskId) throw new Error("Worker terminal task binding does not match.");
  if (value.attemptId !== expected.attemptId) throw new Error("Worker terminal attempt binding does not match.");
  if (value.executionClass !== expected.executionClass) {
    throw new Error("Worker terminal execution class binding does not match.");
  }
  if (typeof value.outcome !== "string" || !OUTCOMES.has(value.outcome as WorkerTerminalOutcome)) {
    throw new Error("Worker terminal outcome is unsupported.");
  }
  const outcome = value.outcome as WorkerTerminalOutcome;
  const metrics = parseMetrics(value.metrics, expected.executionClass);
  const failureCode = parseFailureCode(value.failureCode, outcome);
  const result = parseResult(value.result, outcome);
  const budget = workerExecutionProfile(expected.executionClass).budget;
  if (resultBytes(result) > budget.maxOutputBytes) {
    throw new Error("Worker terminal result exceeds the execution budget.");
  }

  return Object.freeze({
    schemaVersion: 1,
    taskId: expected.taskId,
    attemptId: expected.attemptId,
    executionClass: expected.executionClass,
    outcome,
    failureCode,
    metrics,
    result,
  });
}
