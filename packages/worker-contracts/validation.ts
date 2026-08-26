import { workerExecutionProfile } from "./profiles";
import type {
  FoundationProbeResult,
  RepositorySnapshotResult,
  RepositorySnapshotSkipCounts,
  WorkerAttemptMetrics,
  WorkerExecutionClass,
  WorkerTerminalEnvelope,
  WorkerTerminalExpectation,
  WorkerTerminalFailureCode,
  WorkerTerminalOutcome,
  WorkerTerminalResult,
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
const FOUNDATION_RESULT_KEYS = ["kind", "nonceDigest"] as const;
const REPOSITORY_RESULT_KEYS = [
  "kind",
  "canonicalRepositoryUrl",
  "defaultBranch",
  "resolvedCommitSha",
  "contentDigest",
  "artifactDigest",
  "compressedBytes",
  "expandedBytes",
  "retainedFileCount",
  "retainedBytes",
  "storedArtifactBytes",
  "skipCounts",
] as const;
const REPOSITORY_SKIP_KEYS = [
  "symlink",
  "hardlink",
  "fileTooLarge",
  "retainedFileLimit",
  "retainedBytesLimit",
] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_SHA_PATTERN = /^[a-f0-9]{40}$/;
const OUTCOMES = new Set<WorkerTerminalOutcome>(["succeeded", "failed", "cancelled"]);
const FOUNDATION_FAILURE_CODES = new Set<WorkerTerminalFailureCode>([
  "WORKER_LOST",
  "WORKER_BUDGET_EXCEEDED",
  "WORKER_OUTPUT_INVALID",
  "WORKER_EXECUTION_FAILED",
  "WORKER_CLASS_UNAVAILABLE",
]);
const REPOSITORY_FAILURE_CODES = new Set<WorkerTerminalFailureCode>([
  ...FOUNDATION_FAILURE_CODES,
  "REPOSITORY_UNAVAILABLE",
  "REPOSITORY_IDENTITY_CHANGED",
  "REPOSITORY_NETWORK_POLICY_FAILED",
  "REPOSITORY_ARCHIVE_UNSAFE",
  "REPOSITORY_ARCHIVE_BUDGET_EXCEEDED",
  "REPOSITORY_ARTIFACT_UPLOAD_FAILED",
]);

const MAX_COMPRESSED_BYTES = 128 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 512 * 1024 * 1024;
const MAX_RETAINED_FILES = 20_000;
const MAX_RETAINED_BYTES = 256 * 1024 * 1024;
const MAX_STORED_ARTIFACT_BYTES = 320 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 50_000;
const MAX_DEFAULT_BRANCH_BYTES = 255;

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

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
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

function parseFoundationResult(value: unknown): FoundationProbeResult {
  if (!isRecord(value)) throw new Error("Successful worker attempts require a result object.");
  assertExactKeys(value, FOUNDATION_RESULT_KEYS, "Worker terminal result");
  if (value.kind !== "foundation_probe") {
    throw new Error("Worker terminal result kind is not supported for the execution class.");
  }
  if (typeof value.nonceDigest !== "string" || !SHA256_PATTERN.test(value.nonceDigest)) {
    throw new Error("Worker terminal result nonce digest is invalid.");
  }
  return Object.freeze({ kind: "foundation_probe", nonceDigest: value.nonceDigest });
}

function parseCanonicalRepositoryUrl(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) {
    throw new Error("Repository snapshot canonical URL is invalid.");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Repository snapshot canonical URL is invalid.");
  }
  if (
    url.protocol !== "https:"
    || url.hostname.toLowerCase() !== "github.com"
    || (url.port && url.port !== "443")
    || url.username
    || url.password
    || url.search
    || url.hash
  ) {
    throw new Error("Repository snapshot canonical URL is invalid.");
  }
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 2 || segments.some((segment) => segment.length === 0)) {
    throw new Error("Repository snapshot canonical URL is invalid.");
  }
  return `https://github.com/${segments[0]}/${segments[1]}`;
}

function parseSkipCounts(value: unknown): RepositorySnapshotSkipCounts {
  if (!isRecord(value)) throw new Error("Repository snapshot skip counts must be an object.");
  assertExactKeys(value, REPOSITORY_SKIP_KEYS, "Repository snapshot skip counts");
  return Object.freeze({
    symlink: boundedInteger(value.symlink, MAX_ARCHIVE_ENTRIES, "skipCounts.symlink"),
    hardlink: boundedInteger(value.hardlink, MAX_ARCHIVE_ENTRIES, "skipCounts.hardlink"),
    fileTooLarge: boundedInteger(value.fileTooLarge, MAX_ARCHIVE_ENTRIES, "skipCounts.fileTooLarge"),
    retainedFileLimit: boundedInteger(value.retainedFileLimit, MAX_ARCHIVE_ENTRIES, "skipCounts.retainedFileLimit"),
    retainedBytesLimit: boundedInteger(value.retainedBytesLimit, MAX_ARCHIVE_ENTRIES, "skipCounts.retainedBytesLimit"),
  });
}

function parseRepositoryResult(value: unknown): RepositorySnapshotResult {
  if (!isRecord(value)) throw new Error("Successful worker attempts require a result object.");
  assertExactKeys(value, REPOSITORY_RESULT_KEYS, "Worker terminal result");
  if (value.kind !== "repository_snapshot_github_public") {
    throw new Error("Worker terminal result kind is not supported for the execution class.");
  }

  const canonicalRepositoryUrl = parseCanonicalRepositoryUrl(value.canonicalRepositoryUrl);
  if (
    typeof value.defaultBranch !== "string"
    || value.defaultBranch.length === 0
    || utf8Bytes(value.defaultBranch) > MAX_DEFAULT_BRANCH_BYTES
  ) {
    throw new Error("Repository snapshot default branch is invalid.");
  }
  if (typeof value.resolvedCommitSha !== "string" || !COMMIT_SHA_PATTERN.test(value.resolvedCommitSha)) {
    throw new Error("Repository snapshot commit SHA is invalid.");
  }
  if (typeof value.contentDigest !== "string" || !SHA256_PATTERN.test(value.contentDigest)) {
    throw new Error("Repository snapshot content digest is invalid.");
  }
  if (typeof value.artifactDigest !== "string" || !SHA256_PATTERN.test(value.artifactDigest)) {
    throw new Error("Repository snapshot artifact digest is invalid.");
  }

  const compressedBytes = boundedInteger(value.compressedBytes, MAX_COMPRESSED_BYTES, "compressedBytes");
  const expandedBytes = boundedInteger(value.expandedBytes, MAX_EXPANDED_BYTES, "expandedBytes");
  const retainedFileCount = boundedInteger(value.retainedFileCount, MAX_RETAINED_FILES, "retainedFileCount");
  const retainedBytes = boundedInteger(value.retainedBytes, MAX_RETAINED_BYTES, "retainedBytes");
  const storedArtifactBytes = boundedInteger(value.storedArtifactBytes, MAX_STORED_ARTIFACT_BYTES, "storedArtifactBytes");
  if (expandedBytes < retainedBytes) {
    throw new Error("Repository snapshot expanded bytes cannot be smaller than retained bytes.");
  }
  if (storedArtifactBytes === 0) {
    throw new Error("Repository snapshot stored artifact must not be empty.");
  }

  return Object.freeze({
    kind: "repository_snapshot_github_public",
    canonicalRepositoryUrl,
    defaultBranch: value.defaultBranch,
    resolvedCommitSha: value.resolvedCommitSha,
    contentDigest: value.contentDigest,
    artifactDigest: value.artifactDigest,
    compressedBytes,
    expandedBytes,
    retainedFileCount,
    retainedBytes,
    storedArtifactBytes,
    skipCounts: parseSkipCounts(value.skipCounts),
  });
}

function parseResult(
  value: unknown,
  outcome: WorkerTerminalOutcome,
  executionClass: WorkerExecutionClass,
): WorkerTerminalResult | null {
  if (outcome !== "succeeded") {
    if (value !== null) throw new Error("Failed or cancelled worker attempts cannot return a result payload.");
    return null;
  }
  switch (executionClass) {
    case "foundation_no_egress_v1":
      return parseFoundationResult(value);
    case "repository_snapshot_github_public_v1":
      return parseRepositoryResult(value);
  }
  const unreachable: never = executionClass;
  throw new Error(`Unsupported worker execution class: ${String(unreachable)}`);
}

function parseFailureCode(
  value: unknown,
  outcome: WorkerTerminalOutcome,
  executionClass: WorkerExecutionClass,
): WorkerTerminalFailureCode | null {
  if (outcome === "succeeded" || outcome === "cancelled") {
    if (value !== null) {
      throw new Error(`${outcome === "succeeded" ? "Successful" : "Cancelled"} worker attempts cannot include a caller-selected failure code.`);
    }
    return null;
  }
  const allowed = executionClass === "foundation_no_egress_v1"
    ? FOUNDATION_FAILURE_CODES
    : REPOSITORY_FAILURE_CODES;
  if (typeof value !== "string" || !allowed.has(value as WorkerTerminalFailureCode)) {
    throw new Error("Worker failure code is not an allowed terminal failure code.");
  }
  return value as WorkerTerminalFailureCode;
}

function resultBytes(value: WorkerTerminalResult | null): number {
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
  const failureCode = parseFailureCode(value.failureCode, outcome, expected.executionClass);
  const result = parseResult(value.result, outcome, expected.executionClass);
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
