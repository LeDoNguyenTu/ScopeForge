import type { WorkspaceRole } from "@/lib/database.types";
import {
  deriveHostedPhase3PersistenceRows,
  type HostedPhase3EvidenceRow,
  type HostedPhase3FindingRow,
} from "@/lib/phase3-results/normalization";
import type { HostedPhase3EnvelopeV1 } from "@/packages/scanner-output/hosted/types";

export type Phase3ImportWorkflowErrorCode =
  | "PHASE3_IMPORT_FORBIDDEN"
  | "PHASE3_IMPORT_ASSET_NOT_AVAILABLE"
  | "PHASE3_IMPORT_ASSET_MISMATCH"
  | "PHASE3_IMPORT_RUN_REF_CONFLICT"
  | "PHASE3_IMPORT_PAYLOAD_INVALID"
  | "PHASE3_IMPORT_EVIDENCE_ID_CONFLICT"
  | "PHASE3_IMPORT_FINDING_ID_CONFLICT"
  | "PHASE3_IMPORT_PERSISTENCE_FAILED";

export class Phase3ImportWorkflowError extends Error {
  readonly code: Phase3ImportWorkflowErrorCode;

  constructor(code: Phase3ImportWorkflowErrorCode, message: string = code) {
    super(message);
    this.name = "Phase3ImportWorkflowError";
    this.code = code;
  }
}

export interface Phase3ImportAsset {
  id: string;
  workspace_id: string;
  kind: string;
  canonical_target: string;
}

export type Phase3ImportFindingRow = HostedPhase3FindingRow;
export type Phase3ImportEvidenceRow = HostedPhase3EvidenceRow;

export interface PersistPhase3ImportInput {
  workspaceId: string;
  assetId: string;
  actorId: string;
  repositoryCanonicalUrl: string;
  runRef: string;
  toolVersion: string;
  scanStartedAt: string;
  scanDurationMs: number;
  scannerDescriptors: string[];
  scannerErrorCount: number;
  filesAnalyzed: number;
  filesSkipped: number;
  totalBytes: number;
  findings: Phase3ImportFindingRow[];
  evidence: Phase3ImportEvidenceRow[];
}

export interface Phase3ImportResult {
  importRunId: string;
  scanJobId: string;
  replayed: boolean;
}

export interface Phase3ImportRepositoryContract {
  loadAsset(workspaceId: string, assetId: string): Promise<Phase3ImportAsset | null>;
  persist(input: PersistPhase3ImportInput): Promise<Phase3ImportResult>;
}

export interface Phase3ImportServiceDependencies {
  repository: Phase3ImportRepositoryContract;
}

export interface ImportHostedPhase3ResultInput {
  actorId: string;
  workspaceId: string;
  role: WorkspaceRole;
  assetId: string;
  envelope: HostedPhase3EnvelopeV1;
}

function assertMutationRole(role: WorkspaceRole): void {
  if (role === "viewer") {
    throw new Phase3ImportWorkflowError("PHASE3_IMPORT_FORBIDDEN");
  }
}

export async function importHostedPhase3Result(
  input: ImportHostedPhase3ResultInput,
  dependencies: Phase3ImportServiceDependencies,
): Promise<Phase3ImportResult> {
  assertMutationRole(input.role);

  const asset = await dependencies.repository.loadAsset(input.workspaceId, input.assetId);
  if (!asset) {
    throw new Phase3ImportWorkflowError("PHASE3_IMPORT_ASSET_NOT_AVAILABLE");
  }
  if (
    asset.id !== input.assetId
    || asset.workspace_id !== input.workspaceId
    || asset.kind !== "repository"
    || asset.canonical_target !== input.envelope.repository.canonicalUrl
  ) {
    throw new Phase3ImportWorkflowError("PHASE3_IMPORT_ASSET_MISMATCH");
  }

  const rows = deriveHostedPhase3PersistenceRows(asset.id, input.envelope);

  return dependencies.repository.persist({
    workspaceId: input.workspaceId,
    assetId: asset.id,
    actorId: input.actorId,
    repositoryCanonicalUrl: asset.canonical_target,
    runRef: input.envelope.runRef,
    toolVersion: input.envelope.tool.version,
    scanStartedAt: input.envelope.scan.startedAt,
    scanDurationMs: input.envelope.scan.durationMs,
    scannerDescriptors: [...input.envelope.scan.scanners],
    scannerErrorCount: input.envelope.scan.scannerErrorCount,
    filesAnalyzed: input.envelope.inventory.filesAnalyzed,
    filesSkipped: input.envelope.inventory.filesSkipped,
    totalBytes: input.envelope.inventory.totalBytes,
    findings: rows.findings,
    evidence: rows.evidence,
  });
}