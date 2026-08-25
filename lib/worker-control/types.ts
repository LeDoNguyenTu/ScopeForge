import type {
  WorkerAttemptMetrics,
  WorkerExecutionClass,
  WorkerTaskContract,
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
  executionClass: WorkerExecutionClass;
  absoluteDeadlineAt: string;
}

export interface WorkerClaimInput {
  workerId: string;
}

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
  failureCode: string | null;
  terminalPayloadDigest: string;
}

export interface WorkerFinalizationResult {
  taskId: string;
  attemptId: string;
  outcome: WorkerTerminalOutcome;
  replayed: boolean;
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
  | "WORKER_CONTROL_FAILED";

export class WorkerControlError extends Error {
  readonly code: WorkerControlErrorCode;

  constructor(code: WorkerControlErrorCode) {
    super(code);
    this.name = "WorkerControlError";
    this.code = code;
  }
}
