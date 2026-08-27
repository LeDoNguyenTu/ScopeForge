import type { Json } from "@/lib/database.types";
import type { RepositorySnapshotDownloadDescriptor } from "@/lib/repository-snapshots/object-store";
import type {
  HostedPhase3EvidenceRow,
  HostedPhase3FindingRow,
} from "@/lib/phase3-results/normalization";

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

export interface RepositoryScanPublicationContext {
  snapshotId: string;
  canonicalRepositoryUrl: string;
  resolvedCommitSha: string;
  contentDigest: string;
  artifactDigest: string;
  retainedFileCount: number;
  retainedBytes: number;
  scannerProfileId: "phase3-hosted-static-v1";
  scannerProfileVersion: 1;
}

export interface RepositoryScanSuccessPersistenceInput extends RepositoryScanLeaseIdentity {
  snapshotId: string;
  repositoryCanonicalUrl: string;
  resolvedCommitSha: string;
  snapshotContentDigest: string;
  snapshotArtifactDigest: string;
  scannerProfileId: "phase3-hosted-static-v1";
  scannerProfileVersion: 1;
  terminalPayloadDigest: string;
  resultDigest: string;
  runRef: string;
  toolVersion: string;
  scanStartedAt: string;
  scanDurationMs: number;
  scannerDescriptors: string[];
  scannerErrorCount: number;
  filesAnalyzed: number;
  filesSkipped: number;
  totalBytes: number;
  wallTimeMs: number;
  cpuTimeMs: number;
  peakMemoryBytes: number;
  inputBytes: number;
  outputBytes: number;
  findings: HostedPhase3FindingRow[];
  evidence: HostedPhase3EvidenceRow[];
}

export interface RepositoryScanPublicationResult {
  taskId: string;
  attemptId: string;
  runId?: string;
  outcome: "succeeded" | "cancelled";
  replayed: boolean;
}

export type RepositoryScanErrorCode =
  | "REPOSITORY_SCAN_ARTIFACT_NOT_AVAILABLE"
  | "REPOSITORY_SCAN_ARTIFACT_AUTHORIZATION_FAILED"
  | "REPOSITORY_SCAN_OUTPUT_INVALID"
  | "REPOSITORY_SCAN_PUBLICATION_REQUIRED"
  | "REPOSITORY_SCAN_TERMINAL_CONFLICT"
  | "REPOSITORY_SCAN_FINDING_ID_CONFLICT"
  | "REPOSITORY_SCAN_EVIDENCE_ID_CONFLICT"
  | "REPOSITORY_SCAN_PUBLICATION_FAILED"
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

export function repositoryScanJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}
