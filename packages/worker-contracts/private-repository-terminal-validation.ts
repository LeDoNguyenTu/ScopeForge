import { workerExecutionProfile } from "./profiles";
import type {
  PrivateRepositorySnapshotResult,
  PrivateRepositorySnapshotTerminalEnvelope,
  PrivateRepositorySnapshotTerminalExpectation,
  RepositorySnapshotSkipCounts,
  WorkerAttemptMetrics,
  WorkerTerminalFailureCode,
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
const RESULT_KEYS = [
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
const SKIP_KEYS = [
  "symlink",
  "hardlink",
  "fileTooLarge",
  "retainedFileLimit",
  "retainedBytesLimit",
] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA40_PATTERN = /^[a-f0-9]{40}$/;
const SHA64_PATTERN = /^[a-f0-9]{64}$/;
const MAX_COMPRESSED_BYTES = 128 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 512 * 1024 * 1024;
const MAX_RETAINED_FILES = 20_000;
const MAX_RETAINED_BYTES = 256 * 1024 * 1024;
const MAX_STORED_ARTIFACT_BYTES = 320 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 50_000;
const MAX_DEFAULT_BRANCH_BYTES = 255;

const PRIVATE_FAILURE_CODES = new Set<WorkerTerminalFailureCode>([
  "WORKER_LOST",
  "WORKER_BUDGET_EXCEEDED",
  "WORKER_OUTPUT_INVALID",
  "WORKER_EXECUTION_FAILED",
  "WORKER_CLASS_UNAVAILABLE",
  "REPOSITORY_UNAVAILABLE",
  "REPOSITORY_IDENTITY_CHANGED",
  "REPOSITORY_NETWORK_POLICY_FAILED",
  "REPOSITORY_ARCHIVE_UNSAFE",
  "REPOSITORY_ARCHIVE_BUDGET_EXCEEDED",
  "REPOSITORY_ARTIFACT_UPLOAD_FAILED",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertExactKeys(value: Record<string, unknown>, keys: readonly string[], context: string): void {
  const actual = Object.keys(value);
  if (actual.length !== keys.length || keys.some((key) => !actual.includes(key))) {
    throw new Error(`${context} has an invalid shape.`);
  }
}

function boundedInteger(value: unknown, maximum: number, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) {
    throw new Error(`${label} exceeds the private repository execution budget.`);
  }
  return value as number;
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function canonicalRepositoryUrl(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) {
    throw new Error("Private repository terminal canonical URL is invalid.");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Private repository terminal canonical URL is invalid.");
  }
  const segments = url.pathname.split("/").filter(Boolean);
  if (
    url.protocol !== "https:"
    || url.hostname.toLowerCase() !== "github.com"
    || (url.port && url.port !== "443")
    || url.username
    || url.password
    || url.search
    || url.hash
    || segments.length !== 2
  ) {
    throw new Error("Private repository terminal canonical URL is invalid.");
  }
  return `https://github.com/${segments[0]}/${segments[1]}`;
}

function parseMetrics(value: unknown): WorkerAttemptMetrics {
  if (!isRecord(value)) throw new Error("Private repository terminal metrics are invalid.");
  assertExactKeys(value, METRIC_KEYS, "Private repository terminal metrics");
  const budget = workerExecutionProfile("repository_snapshot_github_private_v1").budget;
  return Object.freeze({
    wallTimeMs: boundedInteger(value.wallTimeMs, budget.maxWallTimeMs, "wallTimeMs"),
    cpuTimeMs: boundedInteger(value.cpuTimeMs, budget.maxCpuTimeMs, "cpuTimeMs"),
    peakMemoryBytes: boundedInteger(value.peakMemoryBytes, budget.maxMemoryBytes, "peakMemoryBytes"),
    inputBytes: boundedInteger(value.inputBytes, budget.maxInputBytes, "inputBytes"),
    outputBytes: boundedInteger(value.outputBytes, budget.maxOutputBytes, "outputBytes"),
  });
}

function parseSkipCounts(value: unknown): RepositorySnapshotSkipCounts {
  if (!isRecord(value)) throw new Error("Private repository terminal skip counts are invalid.");
  assertExactKeys(value, SKIP_KEYS, "Private repository terminal skip counts");
  return Object.freeze({
    symlink: boundedInteger(value.symlink, MAX_ARCHIVE_ENTRIES, "skipCounts.symlink"),
    hardlink: boundedInteger(value.hardlink, MAX_ARCHIVE_ENTRIES, "skipCounts.hardlink"),
    fileTooLarge: boundedInteger(value.fileTooLarge, MAX_ARCHIVE_ENTRIES, "skipCounts.fileTooLarge"),
    retainedFileLimit: boundedInteger(value.retainedFileLimit, MAX_ARCHIVE_ENTRIES, "skipCounts.retainedFileLimit"),
    retainedBytesLimit: boundedInteger(value.retainedBytesLimit, MAX_ARCHIVE_ENTRIES, "skipCounts.retainedBytesLimit"),
  });
}

function parseResult(value: unknown): PrivateRepositorySnapshotResult {
  if (!isRecord(value)) throw new Error("Private repository successful terminal requires a result.");
  assertExactKeys(value, RESULT_KEYS, "Private repository terminal result");
  if (value.kind !== "repository_snapshot_github_private") {
    throw new Error("Private repository terminal result kind is invalid.");
  }
  if (typeof value.defaultBranch !== "string" || utf8Bytes(value.defaultBranch) < 1 || utf8Bytes(value.defaultBranch) > MAX_DEFAULT_BRANCH_BYTES) {
    throw new Error("Private repository terminal default branch is invalid.");
  }
  if (typeof value.resolvedCommitSha !== "string" || !SHA40_PATTERN.test(value.resolvedCommitSha)) {
    throw new Error("Private repository terminal commit is invalid.");
  }
  if (typeof value.contentDigest !== "string" || !SHA64_PATTERN.test(value.contentDigest)) {
    throw new Error("Private repository terminal content digest is invalid.");
  }
  if (typeof value.artifactDigest !== "string" || !SHA64_PATTERN.test(value.artifactDigest)) {
    throw new Error("Private repository terminal artifact digest is invalid.");
  }
  const compressedBytes = boundedInteger(value.compressedBytes, MAX_COMPRESSED_BYTES, "compressedBytes");
  const expandedBytes = boundedInteger(value.expandedBytes, MAX_EXPANDED_BYTES, "expandedBytes");
  const retainedFileCount = boundedInteger(value.retainedFileCount, MAX_RETAINED_FILES, "retainedFileCount");
  const retainedBytes = boundedInteger(value.retainedBytes, MAX_RETAINED_BYTES, "retainedBytes");
  const storedArtifactBytes = boundedInteger(value.storedArtifactBytes, MAX_STORED_ARTIFACT_BYTES, "storedArtifactBytes");
  if (expandedBytes < retainedBytes || storedArtifactBytes === 0) {
    throw new Error("Private repository terminal artifact metrics are invalid.");
  }
  return Object.freeze({
    kind: "repository_snapshot_github_private",
    canonicalRepositoryUrl: canonicalRepositoryUrl(value.canonicalRepositoryUrl),
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

export function validatePrivateRepositorySnapshotTerminalEnvelope(
  value: unknown,
  expectation: PrivateRepositorySnapshotTerminalExpectation,
): PrivateRepositorySnapshotTerminalEnvelope {
  if (!isRecord(value)) throw new Error("Private repository terminal must be an object.");
  assertExactKeys(value, ENVELOPE_KEYS, "Private repository terminal");
  if (
    value.schemaVersion !== 1
    || value.taskId !== expectation.taskId
    || value.attemptId !== expectation.attemptId
    || value.executionClass !== "repository_snapshot_github_private_v1"
    || !UUID_PATTERN.test(expectation.taskId)
    || !UUID_PATTERN.test(expectation.attemptId)
  ) {
    throw new Error("Private repository terminal identity is invalid.");
  }
  if (value.outcome !== "succeeded" && value.outcome !== "failed" && value.outcome !== "cancelled") {
    throw new Error("Private repository terminal outcome is invalid.");
  }

  const metrics = parseMetrics(value.metrics);
  if (value.outcome === "succeeded") {
    if (value.failureCode !== null) throw new Error("Successful private repository terminal cannot carry a failure code.");
    return Object.freeze({
      schemaVersion: 1,
      taskId: expectation.taskId,
      attemptId: expectation.attemptId,
      executionClass: "repository_snapshot_github_private_v1",
      outcome: "succeeded",
      failureCode: null,
      metrics,
      result: parseResult(value.result),
    });
  }

  if (value.result !== null) throw new Error("Failed or cancelled private repository terminal cannot return a result.");
  if (value.outcome === "cancelled") {
    if (value.failureCode !== null) throw new Error("Cancelled private repository terminal cannot carry a failure code.");
    return Object.freeze({
      schemaVersion: 1,
      taskId: expectation.taskId,
      attemptId: expectation.attemptId,
      executionClass: "repository_snapshot_github_private_v1",
      outcome: "cancelled",
      failureCode: null,
      metrics,
      result: null,
    });
  }

  if (typeof value.failureCode !== "string" || !PRIVATE_FAILURE_CODES.has(value.failureCode as WorkerTerminalFailureCode)) {
    throw new Error("Failed private repository terminal requires a closed failure code.");
  }
  return Object.freeze({
    schemaVersion: 1,
    taskId: expectation.taskId,
    attemptId: expectation.attemptId,
    executionClass: "repository_snapshot_github_private_v1",
    outcome: "failed",
    failureCode: value.failureCode as WorkerTerminalFailureCode,
    metrics,
    result: null,
  });
}
