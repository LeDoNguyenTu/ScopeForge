export type WorkerExecutionClass =
  | "foundation_no_egress_v1"
  | "repository_snapshot_github_public_v1"
  | "phase3_repository_scan_no_egress_v1";
export type WorkerNetworkPolicy =
  | "none"
  | "github_public_archive_and_attempt_artifact_put_v1";
export type WorkerTerminalOutcome = "succeeded" | "failed" | "cancelled";
export type WorkerTerminalFailureCode =
  | "WORKER_LOST"
  | "WORKER_BUDGET_EXCEEDED"
  | "WORKER_OUTPUT_INVALID"
  | "WORKER_EXECUTION_FAILED"
  | "WORKER_CLASS_UNAVAILABLE"
  | "REPOSITORY_UNAVAILABLE"
  | "REPOSITORY_IDENTITY_CHANGED"
  | "REPOSITORY_NETWORK_POLICY_FAILED"
  | "REPOSITORY_ARCHIVE_UNSAFE"
  | "REPOSITORY_ARCHIVE_BUDGET_EXCEEDED"
  | "REPOSITORY_ARTIFACT_UPLOAD_FAILED"
  | "REPOSITORY_SCAN_ARTIFACT_UNAVAILABLE"
  | "REPOSITORY_SCAN_ARTIFACT_INTEGRITY_FAILED"
  | "REPOSITORY_SCAN_SNAPSHOT_INVALID"
  | "REPOSITORY_SCAN_SANDBOX_FAILED"
  | "REPOSITORY_SCAN_SCANNER_FAILED"
  | "REPOSITORY_SCAN_OUTPUT_INVALID";

export interface WorkerExecutionBudget {
  maxWallTimeMs: number;
  maxCpuTimeMs: number;
  maxMemoryBytes: number;
  maxProcesses: number;
  maxInputFiles: number;
  maxInputBytes: number;
  maxScratchBytes: number;
  maxOutputBytes: number;
}

export interface WorkerExecutionProfile {
  executionClass: WorkerExecutionClass;
  networkPolicy: WorkerNetworkPolicy;
  budget: WorkerExecutionBudget;
}

export interface FoundationProbeInput {
  kind: "foundation_probe";
  nonce: string;
}

export interface RepositorySnapshotUploadDescriptor {
  method: "PUT";
  url: string;
  expiresAt: string;
}

export interface RepositorySnapshotInput {
  kind: "repository_snapshot_github_public";
  owner: string;
  repository: string;
  canonicalRepositoryUrl: string;
  artifactUpload: RepositorySnapshotUploadDescriptor;
}

export interface RepositoryScanInput {
  kind: "phase3_repository_scan";
  snapshotId: string;
  canonicalRepositoryUrl: string;
  resolvedCommitSha: string;
  contentDigest: string;
  artifactDigest: string;
  storedArtifactBytes: number;
  retainedFileCount: number;
  retainedBytes: number;
  scannerProfileId: "phase3-hosted-static-v1";
  scannerProfileVersion: 1;
}

export type WorkerTaskInput = FoundationProbeInput | RepositorySnapshotInput | RepositoryScanInput;

export interface WorkerTaskContract {
  taskId: string;
  attemptId: string;
  executionClass: WorkerExecutionClass;
  leaseToken: string;
  absoluteDeadlineAt: string;
  budget: WorkerExecutionBudget;
  input: WorkerTaskInput;
}

export interface WorkerAttemptMetrics {
  wallTimeMs: number;
  cpuTimeMs: number;
  peakMemoryBytes: number;
  inputBytes: number;
  outputBytes: number;
}

export interface FoundationProbeResult {
  kind: "foundation_probe";
  nonceDigest: string;
}

export interface RepositorySnapshotSkipCounts {
  symlink: number;
  hardlink: number;
  fileTooLarge: number;
  retainedFileLimit: number;
  retainedBytesLimit: number;
}

export interface RepositorySnapshotResult {
  kind: "repository_snapshot_github_public";
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
  skipCounts: RepositorySnapshotSkipCounts;
}

export interface RepositoryScanResult {
  kind: "phase3_repository_scan";
  snapshotId: string;
  canonicalRepositoryUrl: string;
  resolvedCommitSha: string;
  contentDigest: string;
  artifactDigest: string;
  scannerProfileId: "phase3-hosted-static-v1";
  scannerProfileVersion: 1;
  resultDigest: string;
  hostedResult: unknown;
}

export type WorkerTerminalResult = FoundationProbeResult | RepositorySnapshotResult | RepositoryScanResult;

export interface WorkerTerminalEnvelope {
  schemaVersion: 1;
  taskId: string;
  attemptId: string;
  executionClass: WorkerExecutionClass;
  outcome: WorkerTerminalOutcome;
  failureCode: WorkerTerminalFailureCode | null;
  metrics: WorkerAttemptMetrics;
  result: WorkerTerminalResult | null;
}

export interface WorkerTerminalExpectation {
  taskId: string;
  attemptId: string;
  executionClass: WorkerExecutionClass;
}
