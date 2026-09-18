import { workerExecutionProfile } from "./profiles";
import type {
  Phase11HttpDiscoveryInput,
  Phase11HttpDiscoveryRecord,
  Phase11HttpDiscoveryResult,
  Phase11HttpDiscoveryTerminalEnvelope,
  Phase11HttpDiscoveryTerminalExpectation,
  WorkerAttemptMetrics,
  WorkerTerminalFailureCode,
  WorkerTerminalOutcome,
} from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ACTION_ID = /^phase11-action:[0-9a-f]{64}$/;
const AUTHORIZATION_ID = /^phase11-authz:[0-9a-f]{64}$/;
const INPUT_KEYS = ["kind", "runId", "actionId", "authorizationId"] as const;
const TERMINAL_KEYS = [
  "schemaVersion",
  "taskId",
  "attemptId",
  "executionClass",
  "outcome",
  "failureCode",
  "metrics",
  "result",
] as const;
const METRIC_KEYS = ["wallTimeMs", "cpuTimeMs", "peakMemoryBytes", "inputBytes", "outputBytes"] as const;
const RESULT_KEYS = ["kind", "requestCount", "records"] as const;
const RECORD_REQUIRED_KEYS = ["routeKind", "status", "redirected"] as const;
const RECORD_OPTIONAL_KEYS = ["contentType", "redirectBlockedReason"] as const;
const ROUTES = new Set(["root", "security-txt", "robots", "sitemap"]);
const REDIRECT_REASONS = new Set(["CROSS_HOST", "SCHEME", "PORT", "CREDENTIALS"]);
const OUTCOMES = new Set<WorkerTerminalOutcome>(["succeeded", "failed", "cancelled"]);
const FAILURE_CODES = new Set<WorkerTerminalFailureCode>([
  "WORKER_LOST",
  "WORKER_BUDGET_EXCEEDED",
  "WORKER_OUTPUT_INVALID",
  "WORKER_EXECUTION_FAILED",
  "WORKER_CLASS_UNAVAILABLE",
  "RUNTIME_WORKER_AUTHORIZATION_FAILED",
  "RUNTIME_WORKER_CANCELLED",
  "RUNTIME_WORKER_NETWORK_POLICY_FAILED",
  "RUNTIME_WORKER_BUDGET_EXCEEDED",
  "RUNTIME_WORKER_OUTPUT_INVALID",
  "RUNTIME_WORKER_EXECUTION_FAILED",
  "HTTP_DISCOVERY_REQUEST_BUDGET",
  "HTTP_DISCOVERY_REQUEST_TIMEOUT",
  "HTTP_DISCOVERY_TOTAL_TIMEOUT",
  "HTTP_DISCOVERY_NETWORK_ERROR",
  "HTTP_DISCOVERY_PROFILE_INVALID",
]);

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
  label = "Value",
): void {
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  const unexpected = keys.filter((key) => !allowed.has(key));
  if (unexpected.length > 0) {
    throw new Error(`${label} contains unexpected fields: ${unexpected.join(", ")}.`);
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new Error(`${label} is missing ${key}.`);
    }
  }
}

function boundedInteger(value: unknown, maximum: number, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > maximum) {
    throw new Error(`${label} exceeds the execution budget.`);
  }
  return value as number;
}

function metrics(value: unknown): WorkerAttemptMetrics {
  const candidate = record(value, "Phase 11 HTTP worker metrics");
  exactKeys(candidate, METRIC_KEYS, [], "Phase 11 HTTP worker metrics");
  const budget = workerExecutionProfile("phase11_http_discovery_v1").budget;
  return Object.freeze({
    wallTimeMs: boundedInteger(candidate.wallTimeMs, budget.maxWallTimeMs, "wallTimeMs"),
    cpuTimeMs: boundedInteger(candidate.cpuTimeMs, budget.maxCpuTimeMs, "cpuTimeMs"),
    peakMemoryBytes: boundedInteger(candidate.peakMemoryBytes, budget.maxMemoryBytes, "peakMemoryBytes"),
    inputBytes: boundedInteger(candidate.inputBytes, budget.maxInputBytes, "inputBytes"),
    outputBytes: boundedInteger(candidate.outputBytes, budget.maxOutputBytes, "outputBytes"),
  });
}

function httpRecord(value: unknown): Phase11HttpDiscoveryRecord {
  const candidate = record(value, "Phase 11 HTTP discovery record");
  exactKeys(candidate, RECORD_REQUIRED_KEYS, RECORD_OPTIONAL_KEYS, "Phase 11 HTTP discovery record");
  if (typeof candidate.routeKind !== "string" || !ROUTES.has(candidate.routeKind)) {
    throw new Error("Phase 11 HTTP discovery route kind is invalid.");
  }
  if (!Number.isInteger(candidate.status)
      || (candidate.status as number) < 100
      || (candidate.status as number) > 599) {
    throw new Error("Phase 11 HTTP discovery status is invalid.");
  }
  if (typeof candidate.redirected !== "boolean") {
    throw new Error("Phase 11 HTTP discovery redirect state is invalid.");
  }
  if (candidate.contentType !== undefined) {
    if (typeof candidate.contentType !== "string"
        || candidate.contentType.length === 0
        || candidate.contentType.length > 160
        || /[\r\n\0]/.test(candidate.contentType)) {
      throw new Error("Phase 11 HTTP discovery content type is invalid.");
    }
  }
  if (candidate.redirectBlockedReason !== undefined) {
    if (typeof candidate.redirectBlockedReason !== "string"
        || !REDIRECT_REASONS.has(candidate.redirectBlockedReason)) {
      throw new Error("Phase 11 HTTP discovery redirect block reason is invalid.");
    }
    if (candidate.redirected) {
      throw new Error("Phase 11 HTTP discovery redirect state is inconsistent.");
    }
  }
  return Object.freeze({
    routeKind: candidate.routeKind as Phase11HttpDiscoveryRecord["routeKind"],
    status: candidate.status as number,
    ...(candidate.contentType === undefined ? {} : { contentType: candidate.contentType }),
    redirected: candidate.redirected,
    ...(candidate.redirectBlockedReason === undefined
      ? {}
      : { redirectBlockedReason: candidate.redirectBlockedReason as Phase11HttpDiscoveryRecord["redirectBlockedReason"] }),
  });
}

function result(value: unknown): Phase11HttpDiscoveryResult {
  const candidate = record(value, "Phase 11 HTTP discovery terminal result");
  exactKeys(candidate, RESULT_KEYS, [], "Phase 11 HTTP discovery terminal result");
  if (candidate.kind !== "phase11_http_discovery") {
    throw new Error("Phase 11 HTTP discovery terminal result kind is invalid.");
  }
  const requestCount = boundedInteger(candidate.requestCount, 12, "requestCount");
  if (!Array.isArray(candidate.records) || candidate.records.length > 4) {
    throw new Error("Phase 11 HTTP discovery records are invalid.");
  }
  return Object.freeze({
    kind: "phase11_http_discovery",
    requestCount,
    records: Object.freeze(candidate.records.map(httpRecord)),
  });
}

export function validatePhase11HttpDiscoveryTaskInput(value: unknown): Phase11HttpDiscoveryInput {
  const candidate = record(value, "Phase 11 HTTP worker task input");
  exactKeys(candidate, INPUT_KEYS, [], "Phase 11 HTTP worker task input");
  if (candidate.kind !== "phase11_http_discovery") {
    throw new Error("Phase 11 HTTP worker task kind is invalid.");
  }
  if (typeof candidate.runId !== "string" || !UUID.test(candidate.runId)) {
    throw new Error("Phase 11 HTTP run identifier is invalid.");
  }
  if (typeof candidate.actionId !== "string" || !ACTION_ID.test(candidate.actionId)) {
    throw new Error("Phase 11 HTTP action identifier is invalid.");
  }
  if (typeof candidate.authorizationId !== "string" || !AUTHORIZATION_ID.test(candidate.authorizationId)) {
    throw new Error("Phase 11 HTTP authorization identifier is invalid.");
  }
  return Object.freeze({
    kind: "phase11_http_discovery",
    runId: candidate.runId,
    actionId: candidate.actionId,
    authorizationId: candidate.authorizationId,
  });
}

export function validatePhase11HttpDiscoveryTerminalEnvelope(
  value: unknown,
  expectation: Phase11HttpDiscoveryTerminalExpectation,
): Phase11HttpDiscoveryTerminalEnvelope {
  const candidate = record(value, "Phase 11 HTTP worker terminal envelope");
  exactKeys(candidate, TERMINAL_KEYS, [], "Phase 11 HTTP worker terminal envelope");
  if (candidate.schemaVersion !== 1) {
    throw new Error("Phase 11 HTTP worker terminal schema version is unsupported.");
  }
  if (candidate.taskId !== expectation.taskId || candidate.attemptId !== expectation.attemptId) {
    throw new Error("Phase 11 HTTP worker terminal identity does not match the active attempt.");
  }
  if (candidate.executionClass !== "phase11_http_discovery_v1") {
    throw new Error("Phase 11 HTTP worker terminal execution class is invalid.");
  }
  if (typeof candidate.outcome !== "string" || !OUTCOMES.has(candidate.outcome as WorkerTerminalOutcome)) {
    throw new Error("Phase 11 HTTP worker terminal outcome is invalid.");
  }
  const outcome = candidate.outcome as WorkerTerminalOutcome;

  if (outcome === "succeeded") {
    if (candidate.failureCode !== null) {
      throw new Error("Successful Phase 11 HTTP worker attempts cannot carry a failure code.");
    }
  } else if (outcome === "cancelled") {
    if (candidate.failureCode !== null || candidate.result !== null) {
      throw new Error("Cancelled Phase 11 HTTP worker attempts cannot carry failure or result payloads.");
    }
  } else if (typeof candidate.failureCode !== "string"
      || !FAILURE_CODES.has(candidate.failureCode as WorkerTerminalFailureCode)) {
    throw new Error("Failed Phase 11 HTTP worker attempts require a closed failure code.");
  }

  if (outcome !== "succeeded" && candidate.result !== null) {
    throw new Error("Non-successful Phase 11 HTTP worker attempts cannot return a result payload.");
  }

  return Object.freeze({
    schemaVersion: 1,
    taskId: expectation.taskId,
    attemptId: expectation.attemptId,
    executionClass: "phase11_http_discovery_v1",
    outcome,
    failureCode: candidate.failureCode as WorkerTerminalFailureCode | null,
    metrics: metrics(candidate.metrics),
    result: outcome === "succeeded" ? result(candidate.result) : null,
  });
}
