import { workerExecutionProfile } from "./profiles";
import type {
  FoundationProbeResult,
  WorkerAttemptMetrics,
  WorkerTerminalEnvelope,
  WorkerTerminalExpectation,
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
const OUTCOMES = new Set<WorkerTerminalOutcome>(["succeeded", "failed", "cancelled"]);

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

function parseFailureCode(value: unknown, outcome: WorkerTerminalOutcome): string | null {
  if (outcome === "succeeded" || outcome === "cancelled") {
    if (value !== null) {
      throw new Error(`${outcome === "succeeded" ? "Successful" : "Cancelled"} worker attempts cannot include a caller-selected failure code.`);
    }
    return null;
  }
  if (typeof value !== "string" || value.length < 1 || value.length > 64) {
    throw new Error("Worker failure code must contain between 1 and 64 characters.");
  }
  if (!/^[A-Z0-9_]+$/.test(value)) {
    throw new Error("Worker failure code must use the closed uppercase code format.");
  }
  return value;
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
