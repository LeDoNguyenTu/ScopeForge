import type { RepositorySnapshotDownloadDescriptor } from "@/lib/repository-snapshots/object-store";

export interface RepositoryScanLeaseIdentity {
  workerId: string;
  taskId: string;
  attemptId: string;
  leaseToken: string;
}

export interface RepositoryScanLeaseBoundArtifact {
  snapshotId: string;
  objectKey: string;
  storedArtifactBytes: number;
  artifactDigest: string;
  leaseExpiresAt: string;
  artifactExpiresAt: string;
}

export interface RepositoryScanArtifactAccess {
  snapshotId: string;
  storedArtifactBytes: number;
  artifactDigest: string;
  download: RepositorySnapshotDownloadDescriptor;
}

export type RepositoryScanErrorCode =
  | "REPOSITORY_SCAN_ARTIFACT_NOT_AVAILABLE"
  | "REPOSITORY_SCAN_ARTIFACT_AUTHORIZATION_FAILED"
  | "WORKER_LEASE_INVALID"
  | "WORKER_DISABLED"
  | "WORKER_JOB_STATE_CONFLICT"
  | "REPOSITORY_SCAN_FAILED";

export class RepositoryScanError extends Error {
  readonly code: RepositoryScanErrorCode;

  constructor(code: RepositoryScanErrorCode) {
    super(code);
    this.name = "RepositoryScanError";
    this.code = code;
  }
}