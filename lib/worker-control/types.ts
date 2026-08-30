import type {
  ActiveCorsValidationInput,
  FoundationProbeInput,
  PassiveRuntimeObservationInput,
  RepositoryScanInput,
  RepositorySnapshotInput,
  WorkerAttemptMetrics,
  WorkerExecutionBudget,
  WorkerExecutionClass,
  WorkerTaskContract,
  WorkerTerminalFailureCode,
  WorkerTerminalOutcome,
} from "@/packages/worker-contracts";

export interface WorkerNodeIdentity {
  workerId: string;
  executionClass: WorkerExecutionClass;
  softwareVersion: string;
}

export interface WorkerRegistrationInput {
  credentialHash: string;
  softwareVersion: string;
}

export interface WorkerRegistrationResult extends WorkerNodeIdentity {}

export interface WorkerDisableResult {
  workerId: string;
  disabledAt: string;
}

export interface WorkerAuthenticationInput {
  workerId: string;
  credentialHash: string;
}

export interface FoundationProbeEnqueueInput {
  workspaceId: string;
  assetId: string;
  actorId: string;
}

export interface FoundationProbeEnqueueResult {
  scanJobId: string;
  taskId: string;
  executionClass: "foundation_no_egress_v1";
  absoluteDeadlineAt: string;
}

export interface RuntimeWorkerEnqueueInput {
  workspaceId: string;
  scanJobId: string;
  actorId: string;
}

export type RuntimeWorkerEnqueueResult =
  | {
      scanJobId: string;
      taskId: string;
      executionClass: "passive_runtime_observation_v1";
      absoluteDeadlineAt: string;
    }
  | {
      scanJobId: string;
      taskId: string;
      executionClass: "active_cors_validation_v1";
      absoluteDeadlineAt: string;
    };

export interface WorkerClaimInput {
  workerId: string;
}

export interface FoundationWorkerPersistenceClaim {
  taskId: string;
  attemptId: string;
  executionClass: "foundation_no_egress_v1";
  leaseToken: string;
  absoluteDeadlineAt: string;
  budget: WorkerExecutionBudget;
  input: FoundationProbeInput;
}

export interface RepositorySnapshotWorkerPersistenceClaim {
  taskId: string;
  attemptId: string;
  executionClass: "repository_snapshot_github_public_v1";
  leaseToken: string;
  absoluteDeadlineAt: string;
  budget: WorkerExecutionBudget;
  artifactObjectKey: string;
  input: Omit<RepositorySnapshotInput, "artifactUpload">;
}

export interface RepositoryScanWorkerPersistenceClaim {
  taskId: string;
  attemptId: string;
  executionClass: "phase3_repository_scan_no_egress_v1";
  leaseToken: string;
  absoluteDeadlineAt: string;
  budget: WorkerExecutionBudget;
  input: RepositoryScanInput;
}

export type WorkerPersistenceClaimResult =
  | FoundationWorkerPersistenceClaim
  | RepositorySnapshotWorkerPersistenceClaim
  | RepositoryScanWorkerPersistenceClaim
  | null;

export interface PassiveRuntimeWorkerPersistenceClaim {
  taskId: string;
  attemptId: string;
  executionClass: "passive_runtime_observation_v1";
  leaseToken: string;
  absoluteDeadlineAt: string;
  budget: WorkerExecutionBudget;
  input: PassiveRuntimeObservationInput;
}

export interface ActiveCorsWorkerPersistenceClaim {
  taskId: string;
  attemptId: string;
  executionClass: "active_cors_validation_v1";
  leaseToken: string;
  absoluteDeadlineAt: string;
  budget: WorkerExecutionBudget;
  input: ActiveCorsValidationInput;
}

export type RuntimeWorkerPersistenceClaimResult =
  | PassiveRuntimeWorkerPersistenceClaim
  | ActiveCorsWorkerPersistenceClaim
  | null;

export type WorkerClaimResult = WorkerTaskContract | null;

export interface WorkerLeaseIdentity {
  workerId: string;
  taskId: string;
  attemptId: string;
  leaseToken: string;
}

export interface WorkerHeartbeatResult {
  cancelRequested: boolean;
  leaseExpiresAt: string;
}

export interface WorkerPersistenceFinalizationInput extends WorkerLeaseIdentity, WorkerAttemptMetrics {
  terminalOutcome: WorkerTerminalOutcome;
  failureCode: WorkerTerminalFailureCode | null;
  terminalPayloadDigest: string;
}

export interface WorkerFinalizationResult {
  taskId: string;
  attemptId: string;
  outcome: WorkerTerminalOutcome;
  replayed: boolean;
}

export interface WorkerFleetNodeSnapshot {
  workerId: string;
  executionClass: WorkerExecutionClass;
  softwareVersion: string;
  registeredAt: string;
  lastSeenAt: string | null;
  disabledAt: string | null;
}

export interface WorkerFleetTaskCounts {
  queued: number;
  leased: number;
  retryWait: number;
  completed: number;
  deadLetter: number;
  cancelled: number;
}

export interface RuntimeWorkerFleetClassHealth<
  TExecutionClass extends "passive_runtime_observation_v1" | "active_cors_validation_v1",
> {
  executionClass: TExecutionClass;
  enabledNodeCount: number;
  leasedCount: number;
  capacity: number;
  available: boolean;
  saturated: boolean;
}

export interface RuntimeWorkerFleetHealth {
  passiveRuntime: RuntimeWorkerFleetClassHealth<"passive_runtime_observation_v1">;
  activeCors: RuntimeWorkerFleetClassHealth<"active_cors_validation_v1">;
}

export interface WorkerFleetSnapshot {
  generatedAt: string;
  nodes: readonly WorkerFleetNodeSnapshot[];
  taskCounts: WorkerFleetTaskCounts;
  activeLeaseCount: number;
  runtimeClasses: RuntimeWorkerFleetHealth;
}

export type WorkerControlErrorCode =
  | "WORKER_AUTHENTICATION_FAILED"
  | "WORKER_DISABLED"
  | "WORKER_NOT_AVAILABLE"
  | "WORKER_CREDENTIAL_INVALID"
  | "WORKER_CREDENTIAL_CONFLICT"
  | "WORKER_VERSION_INVALID"
  | "WORKER_PROBE_ACCESS_DENIED"
  | "WORKER_PROBE_ASSET_MISMATCH"
  | "WORKER_LEASE_INVALID"
  | "WORKER_TERMINAL_INVALID"
  | "WORKER_TERMINAL_CONFLICT"
  | "WORKER_BUDGET_EXCEEDED"
  | "WORKER_JOB_NOT_AVAILABLE"
  | "WORKER_JOB_STATE_CONFLICT"
  | "REPOSITORY_SNAPSHOT_PUBLICATION_REQUIRED"
  | "REPOSITORY_SCAN_PUBLICATION_REQUIRED"
  | "REPOSITORY_SCAN_ARTIFACT_NOT_AVAILABLE"
  | "REPOSITORY_UNAVAILABLE"
  | "REPOSITORY_IDENTITY_CHANGED"
  | "REPOSITORY_NETWORK_POLICY_FAILED"
  | "REPOSITORY_ARCHIVE_UNSAFE"
  | "REPOSITORY_ARCHIVE_BUDGET_EXCEEDED"
  | "REPOSITORY_ARTIFACT_UPLOAD_FAILED"
  | "RUNTIME_WORKER_ACCESS_DENIED"
  | "RUNTIME_WORKER_ACTIVE_LIMIT"
  | "RUNTIME_WORKER_TASK_INVALID"
  | "RUNTIME_WORKER_CLASS_MISMATCH"
  | "WORKER_CONTROL_FAILED";

export class WorkerControlError extends Error {
  readonly code: WorkerControlErrorCode;

  constructor(code: WorkerControlErrorCode) {
    super(code);
    this.name = "WorkerControlError";
    this.code = code;
  }
}