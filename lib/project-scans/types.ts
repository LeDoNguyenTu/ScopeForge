import type { GitHubRepositorySummary } from "@/lib/github-app/types";

export type ProjectScanState =
  | "idle"
  | "snapshot_queued"
  | "waiting_scan_runtime"
  | "scan_queued"
  | "retry_pending";

export type RecoverableProjectScanState =
  | "waiting_scan_runtime"
  | "retry_pending"
  | "scan_queued";

export interface ConnectedProjectScanContext {
  workspaceId: string;
  assetId: string;
  actorId: string;
  linkId: string;
  connectionId: string;
  installationId: number;
  repositoryId: number;
  canonicalTarget: string;
  isPrivate: boolean;
  accessStatus: "active" | "inaccessible" | "removed";
}

export interface ConnectedProjectContinuationContext {
  workspaceId: string;
  assetId: string;
  actorId: string;
  linkId: string;
  repositoryId: number;
  canonicalTarget: string;
  isPrivate: boolean;
  accessStatus: "active" | "inaccessible" | "removed";
  snapshotTaskId: string;
  snapshotId: string;
  state: ProjectScanState;
}

export interface ConnectedProjectScanRecovery {
  snapshotTaskId: string;
  snapshotId: string;
  state: RecoverableProjectScanState;
}

export type ProjectScanRequestResult =
  | { status: "snapshot_queued"; taskId: string }
  | { status: "private_acquisition_required" }
  | { status: "snapshot_runtime_unavailable" };

export type ProjectScanContinuationResult =
  | { status: "scan_queued"; taskId: string; scanJobId: string; replayed: boolean }
  | { status: "waiting_scan_runtime" }
  | { status: "retry_pending" }
  | { status: "ignored" };

export type ProjectScanResumeResult =
  | { status: "scan_queued"; taskId: string; scanJobId: string; replayed: boolean }
  | { status: "retry_pending" }
  | { status: "scan_runtime_unavailable" }
  | { status: "no_pending_scan" };

export type ProjectScanErrorCode =
  | "PROJECT_SCAN_INPUT_INVALID"
  | "PROJECT_SCAN_NOT_CONNECTED"
  | "PROJECT_SCAN_ACCESS_INACTIVE"
  | "PROJECT_SCAN_PROVIDER_FAILED"
  | "PROJECT_SCAN_REPOSITORY_MISMATCH"
  | "PROJECT_SCAN_PERSIST_FAILED";

export class ProjectScanError extends Error {
  constructor(public readonly code: ProjectScanErrorCode, message: string) {
    super(message);
    this.name = "ProjectScanError";
  }
}

export interface ProjectScanRevalidatedRepository {
  repository: GitHubRepositorySummary;
}
