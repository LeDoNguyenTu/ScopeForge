import type { Json } from "@/lib/database.types";
import type { WorkerAttemptMetrics, WorkerTerminalEnvelope } from "@/packages/worker-contracts";

export interface RequestRepositorySnapshotInput {
  workspaceId: string;
  assetId: string;
  actorId: string;
}

export interface RequestRepositorySnapshotResult {
  scanJobId: string;
  taskId: string;
  executionClass: "repository_snapshot_github_public_v1";
  absoluteDeadlineAt: string;
}

export interface RepositorySnapshotAttemptArtifact {
  objectKey: string;
  createdAt: string;
}

export interface RepositorySnapshotLeaseIdentity {
  workerId: string;
  taskId: string;
  attemptId: string;
  leaseToken: string;
}

export interface RepositorySnapshotPublicationInput extends RepositorySnapshotLeaseIdentity, WorkerAttemptMetrics {
  terminalPayloadDigest: string;
  canonicalRepositoryUrl: string;
  defaultBranch: string;
  resolvedCommitSha: string;
  contentDigest: string;
  artifactDigest: string;
  compressedBytes: number;
  expandedBytes: number;
  retainedFileCount: number;
  retainedBytes: number;
  storedArtifactBytes: number;
  skipCounts: Json;
  serverObservedObjectBytes: number;
}

export interface RepositorySnapshotPublicationResult {
  taskId: string;
  attemptId: string;
  snapshotId?: string;
  outcome: "succeeded" | "cancelled";
  replayed: boolean;
}

export interface PublishRepositorySnapshotAttemptInput {
  workerId: string;
  leaseToken: string;
  terminal: unknown;
}

export type ValidatedRepositorySnapshotTerminal = WorkerTerminalEnvelope & {
  executionClass: "repository_snapshot_github_public_v1";
  outcome: "succeeded";
  result: NonNullable<WorkerTerminalEnvelope["result"]> & {
    kind: "repository_snapshot_github_public";
  };
};

export type RepositorySnapshotErrorCode =
  | "REPOSITORY_SNAPSHOT_REQUEST_INVALID"
  | "REPOSITORY_SNAPSHOT_ACCESS_DENIED"
  | "REPOSITORY_SNAPSHOT_ASSET_MISMATCH"
  | "REPOSITORY_SNAPSHOT_COOLDOWN"
  | "REPOSITORY_SNAPSHOT_DAILY_LIMIT"
  | "REPOSITORY_SNAPSHOT_ACTIVE_LIMIT"
  | "REPOSITORY_SNAPSHOT_TASK_INVALID"
  | "REPOSITORY_SNAPSHOT_ARTIFACT_NOT_AVAILABLE"
  | "REPOSITORY_SNAPSHOT_ARTIFACT_SIZE_MISMATCH"
  | "REPOSITORY_SNAPSHOT_TERMINAL_INVALID"
  | "REPOSITORY_SNAPSHOT_TERMINAL_CONFLICT"
  | "REPOSITORY_SNAPSHOT_PUBLICATION_REQUIRED"
  | "WORKER_LEASE_INVALID"
  | "WORKER_DISABLED"
  | "WORKER_JOB_STATE_CONFLICT"
  | "REPOSITORY_SNAPSHOT_FAILED";

export class RepositorySnapshotError extends Error {
  readonly code: RepositorySnapshotErrorCode;

  constructor(code: RepositorySnapshotErrorCode) {
    super(code);
    this.name = "RepositorySnapshotError";
    this.code = code;
  }
}
