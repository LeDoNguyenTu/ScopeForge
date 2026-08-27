import { createHash } from "node:crypto";
import {
  validateWorkerTerminalEnvelope,
  type RepositorySnapshotResult,
  type WorkerTerminalEnvelope,
} from "@/packages/worker-contracts";
import type { RepositorySnapshotObjectStore } from "./object-store";
import type { RepositorySnapshotRepository } from "./repository";
import {
  RepositorySnapshotError,
  type PublishRepositorySnapshotAttemptInput,
  type RequestRepositorySnapshotInput,
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

function assertUuid(value: string, label: string): void {
  if (!UUID_PATTERN.test(value)) throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_REQUEST_INVALID");
  if (label.length === 0) throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_REQUEST_INVALID");
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function terminalDigest(terminal: WorkerTerminalEnvelope): string {
  return sha256(JSON.stringify(terminal));
}

function terminalIdentity(value: unknown): { taskId: string; attemptId: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_TERMINAL_INVALID");
  }
  const candidate = value as Record<string, unknown>;
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

export async function publishRepositorySnapshotAttempt(
  input: PublishRepositorySnapshotAttemptInput,
  dependencies: RepositorySnapshotServiceDependencies,
) {
  assertUuid(input.workerId, "workerId");
  if (!/^[a-f0-9]{64}$/.test(input.leaseToken)) {
    throw new RepositorySnapshotError("WORKER_LEASE_INVALID");
  }

  const terminal = validateSuccessfulRepositoryTerminal(input.terminal);
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
