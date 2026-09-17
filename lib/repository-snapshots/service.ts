import { createHash } from "node:crypto";
import {
  validateWorkerTerminalEnvelope,
  type PrivateRepositorySnapshotResult,
  type RepositorySnapshotResult,
  type WorkerAttemptMetrics,
  type WorkerTerminalEnvelope,
} from "@/packages/worker-contracts";
import type { RepositorySnapshotObjectStore } from "./object-store";
import type { RepositorySnapshotRepository } from "./repository";
import {
  RepositorySnapshotError,
  type PublishRepositorySnapshotAttemptInput,
  type RequestPrivateRepositorySnapshotInput,
  type RequestRepositorySnapshotInput,
  type ValidatedPrivateRepositorySnapshotTerminal,
} from "./types";

export type { RepositorySnapshotRepository } from "./repository";

export interface RepositorySnapshotRequestDependencies {
  repository: RepositorySnapshotRepository;
}

export interface RepositorySnapshotServiceDependencies extends RepositorySnapshotRequestDependencies {
  objectStore: RepositorySnapshotObjectStore;
}

const MAX_STORED_ARTIFACT_BYTES = 335_544_320;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA40_PATTERN = /^[a-f0-9]{40}$/;
const SHA64_PATTERN = /^[a-f0-9]{64}$/;
const REPOSITORY_URL_PATTERN = /^https:\/\/github[.]com\/[^/?#]+\/[^/?#]+$/;

function assertUuid(value: string, label: string): void {
  if (!UUID_PATTERN.test(value)) throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_REQUEST_INVALID");
  if (label.length === 0) throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_REQUEST_INVALID");
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function terminalDigest(terminal: unknown): string {
  return sha256(JSON.stringify(terminal));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === [...expected].sort()[index]);
}

function boundedInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}

function terminalIdentity(value: unknown): { taskId: string; attemptId: string } {
  if (!isRecord(value)) {
    throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_TERMINAL_INVALID");
  }
  const candidate = value;
  if (typeof candidate.taskId !== "string" || typeof candidate.attemptId !== "string") {
    throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_TERMINAL_INVALID");
  }
  if (!UUID_PATTERN.test(candidate.taskId) || !UUID_PATTERN.test(candidate.attemptId)) {
    throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_TERMINAL_INVALID");
  }
  return { taskId: candidate.taskId, attemptId: candidate.attemptId };
}

function validateSuccessfulRepositoryTerminal(value: unknown): WorkerTerminalEnvelope & {
  executionClass: "repository_snapshot_github_public_v1";
  outcome: "succeeded";
  result: RepositorySnapshotResult;
} {
  const identity = terminalIdentity(value);
  let terminal: WorkerTerminalEnvelope;
  try {
    terminal = validateWorkerTerminalEnvelope(value, {
      ...identity,
      executionClass: "repository_snapshot_github_public_v1",
    });
  } catch {
    throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_TERMINAL_INVALID");
  }
  if (
    terminal.executionClass !== "repository_snapshot_github_public_v1"
    || terminal.outcome !== "succeeded"
    || terminal.failureCode !== null
    || terminal.result?.kind !== "repository_snapshot_github_public"
  ) {
    throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_TERMINAL_INVALID");
  }
  return terminal as WorkerTerminalEnvelope & {
    executionClass: "repository_snapshot_github_public_v1";
    outcome: "succeeded";
    result: RepositorySnapshotResult;
  };
}

function validatePrivateMetrics(value: unknown): WorkerAttemptMetrics {
  if (!isRecord(value) || !exactKeys(value, [
    "wallTimeMs", "cpuTimeMs", "peakMemoryBytes", "inputBytes", "outputBytes",
  ])) {
    throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_TERMINAL_INVALID");
  }
  if (
    !boundedInteger(value.wallTimeMs, 0, 300_000)
    || !boundedInteger(value.cpuTimeMs, 0, 120_000)
    || !boundedInteger(value.peakMemoryBytes, 0, 536_870_912)
    || !boundedInteger(value.inputBytes, 0, 268_435_456)
    || !boundedInteger(value.outputBytes, 0, 65_536)
  ) {
    throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_TERMINAL_INVALID");
  }
  return Object.freeze({
    wallTimeMs: value.wallTimeMs,
    cpuTimeMs: value.cpuTimeMs,
    peakMemoryBytes: value.peakMemoryBytes,
    inputBytes: value.inputBytes,
    outputBytes: value.outputBytes,
  });
}

function validatePrivateResult(value: unknown): PrivateRepositorySnapshotResult {
  if (!isRecord(value) || !exactKeys(value, [
    "kind", "canonicalRepositoryUrl", "defaultBranch", "resolvedCommitSha",
    "contentDigest", "artifactDigest", "compressedBytes", "expandedBytes",
    "retainedFileCount", "retainedBytes", "storedArtifactBytes", "skipCounts",
  ])) {
    throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_TERMINAL_INVALID");
  }
  if (
    value.kind !== "repository_snapshot_github_private"
    || typeof value.canonicalRepositoryUrl !== "string"
    || !REPOSITORY_URL_PATTERN.test(value.canonicalRepositoryUrl)
    || value.canonicalRepositoryUrl.length > 512
    || typeof value.defaultBranch !== "string"
    || Buffer.byteLength(value.defaultBranch, "utf8") < 1
    || Buffer.byteLength(value.defaultBranch, "utf8") > 255
    || typeof value.resolvedCommitSha !== "string"
    || !SHA40_PATTERN.test(value.resolvedCommitSha)
    || typeof value.contentDigest !== "string"
    || !SHA64_PATTERN.test(value.contentDigest)
    || typeof value.artifactDigest !== "string"
    || !SHA64_PATTERN.test(value.artifactDigest)
    || !boundedInteger(value.compressedBytes, 0, 134_217_728)
    || !boundedInteger(value.expandedBytes, 0, 536_870_912)
    || !boundedInteger(value.retainedFileCount, 0, 20_000)
    || !boundedInteger(value.retainedBytes, 0, 268_435_456)
    || !boundedInteger(value.storedArtifactBytes, 1, MAX_STORED_ARTIFACT_BYTES)
    || value.expandedBytes < value.retainedBytes
    || !isRecord(value.skipCounts)
    || !exactKeys(value.skipCounts, [
      "symlink", "hardlink", "fileTooLarge", "retainedFileLimit", "retainedBytesLimit",
    ])
  ) {
    throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_TERMINAL_INVALID");
  }
  for (const key of ["symlink", "hardlink", "fileTooLarge", "retainedFileLimit", "retainedBytesLimit"] as const) {
    if (!boundedInteger(value.skipCounts[key], 0, 50_000)) {
      throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_TERMINAL_INVALID");
    }
  }
  return Object.freeze({
    kind: "repository_snapshot_github_private",
    canonicalRepositoryUrl: value.canonicalRepositoryUrl,
    defaultBranch: value.defaultBranch,
    resolvedCommitSha: value.resolvedCommitSha,
    contentDigest: value.contentDigest,
    artifactDigest: value.artifactDigest,
    compressedBytes: value.compressedBytes,
    expandedBytes: value.expandedBytes,
    retainedFileCount: value.retainedFileCount,
    retainedBytes: value.retainedBytes,
    storedArtifactBytes: value.storedArtifactBytes,
    skipCounts: Object.freeze({
      symlink: value.skipCounts.symlink as number,
      hardlink: value.skipCounts.hardlink as number,
      fileTooLarge: value.skipCounts.fileTooLarge as number,
      retainedFileLimit: value.skipCounts.retainedFileLimit as number,
      retainedBytesLimit: value.skipCounts.retainedBytesLimit as number,
    }),
  });
}

function validateSuccessfulPrivateRepositoryTerminal(value: unknown): ValidatedPrivateRepositorySnapshotTerminal {
  const identity = terminalIdentity(value);
  if (!isRecord(value) || !exactKeys(value, [
    "schemaVersion", "taskId", "attemptId", "executionClass", "outcome", "failureCode", "metrics", "result",
  ])) {
    throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_TERMINAL_INVALID");
  }
  if (
    value.schemaVersion !== 1
    || value.executionClass !== "repository_snapshot_github_private_v1"
    || value.outcome !== "succeeded"
    || value.failureCode !== null
  ) {
    throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_TERMINAL_INVALID");
  }
  return Object.freeze({
    schemaVersion: 1,
    taskId: identity.taskId,
    attemptId: identity.attemptId,
    executionClass: "repository_snapshot_github_private_v1",
    outcome: "succeeded",
    failureCode: null,
    metrics: validatePrivateMetrics(value.metrics),
    result: validatePrivateResult(value.result),
  });
}

export async function requestRepositorySnapshot(
  input: RequestRepositorySnapshotInput,
  dependencies: RepositorySnapshotRequestDependencies,
) {
  assertUuid(input.workspaceId, "workspaceId");
  assertUuid(input.assetId, "assetId");
  assertUuid(input.actorId, "actorId");
  return dependencies.repository.enqueue({
    workspaceId: input.workspaceId,
    assetId: input.assetId,
    actorId: input.actorId,
  });
}

export async function requestPrivateRepositorySnapshot(
  input: RequestPrivateRepositorySnapshotInput,
  dependencies: RepositorySnapshotRequestDependencies,
) {
  assertUuid(input.workspaceId, "workspaceId");
  assertUuid(input.assetId, "assetId");
  assertUuid(input.actorId, "actorId");
  assertUuid(input.githubRepositoryLinkId, "githubRepositoryLinkId");
  return dependencies.repository.enqueuePrivate({
    workspaceId: input.workspaceId,
    assetId: input.assetId,
    actorId: input.actorId,
    githubRepositoryLinkId: input.githubRepositoryLinkId,
  });
}

async function publishValidatedSnapshot(
  input: { workerId: string; leaseToken: string },
  terminal: {
    taskId: string;
    attemptId: string;
    metrics: WorkerAttemptMetrics;
    result: RepositorySnapshotResult | PrivateRepositorySnapshotResult;
  },
  dependencies: RepositorySnapshotServiceDependencies,
) {
  const artifact = await dependencies.repository.getAttemptArtifact({
    workerId: input.workerId,
    taskId: terminal.taskId,
    attemptId: terminal.attemptId,
    leaseToken: input.leaseToken,
  });
  const observed = await dependencies.objectStore.headObject(artifact.objectKey);
  if (!observed.exists || observed.size === null) {
    throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_ARTIFACT_NOT_AVAILABLE");
  }
  if (
    observed.size < 1
    || observed.size > MAX_STORED_ARTIFACT_BYTES
    || observed.size !== terminal.result.storedArtifactBytes
  ) {
    throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_ARTIFACT_SIZE_MISMATCH");
  }

  return dependencies.repository.publish({
    workerId: input.workerId,
    taskId: terminal.taskId,
    attemptId: terminal.attemptId,
    leaseToken: input.leaseToken,
    terminalPayloadDigest: terminalDigest(terminal),
    canonicalRepositoryUrl: terminal.result.canonicalRepositoryUrl,
    defaultBranch: terminal.result.defaultBranch,
    resolvedCommitSha: terminal.result.resolvedCommitSha,
    contentDigest: terminal.result.contentDigest,
    artifactDigest: terminal.result.artifactDigest,
    compressedBytes: terminal.result.compressedBytes,
    expandedBytes: terminal.result.expandedBytes,
    retainedFileCount: terminal.result.retainedFileCount,
    retainedBytes: terminal.result.retainedBytes,
    storedArtifactBytes: terminal.result.storedArtifactBytes,
    skipCounts: {
      symlink: terminal.result.skipCounts.symlink,
      hardlink: terminal.result.skipCounts.hardlink,
      fileTooLarge: terminal.result.skipCounts.fileTooLarge,
      retainedFileLimit: terminal.result.skipCounts.retainedFileLimit,
      retainedBytesLimit: terminal.result.skipCounts.retainedBytesLimit,
    },
    wallTimeMs: terminal.metrics.wallTimeMs,
    cpuTimeMs: terminal.metrics.cpuTimeMs,
    peakMemoryBytes: terminal.metrics.peakMemoryBytes,
    inputBytes: terminal.metrics.inputBytes,
    outputBytes: terminal.metrics.outputBytes,
    serverObservedObjectBytes: observed.size,
  });
}

export async function publishRepositorySnapshotAttempt(
  input: PublishRepositorySnapshotAttemptInput,
  dependencies: RepositorySnapshotServiceDependencies,
) {
  assertUuid(input.workerId, "workerId");
  if (!/^[a-f0-9]{64}$/.test(input.leaseToken)) {
    throw new RepositorySnapshotError("WORKER_LEASE_INVALID");
  }
  const terminal = validateSuccessfulRepositoryTerminal(input.terminal);
  return publishValidatedSnapshot(input, terminal, dependencies);
}

export async function publishPrivateRepositorySnapshotAttempt(
  input: PublishRepositorySnapshotAttemptInput,
  dependencies: RepositorySnapshotServiceDependencies,
) {
  assertUuid(input.workerId, "workerId");
  if (!/^[a-f0-9]{64}$/.test(input.leaseToken)) {
    throw new RepositorySnapshotError("WORKER_LEASE_INVALID");
  }
  const terminal = validateSuccessfulPrivateRepositoryTerminal(input.terminal);
  return publishValidatedSnapshot(input, terminal, dependencies);
}
