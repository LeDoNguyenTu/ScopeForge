import type { WorkspaceRole } from "@/lib/database.types";
import {
  createHostedEvidenceIdentity,
  createHostedFindingIdentity,
} from "@/packages/scanner-output/hosted/identity";
import type { HostedPhase3EnvelopeV1 } from "@/packages/scanner-output/hosted/types";
import { resolvePhase3Source } from "./source-registry";

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

export interface Phase3ImportFindingRow {
  finding_id: string;
  source_kind: "deterministic-passive-scanner";
  source_id: string;
  source_version: string;
  scan_run_ref: string;
  rule_ref: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  confidence: "high" | "medium" | "low";
  validation_state: "static_confirmed" | "unvalidated";
  provenance_kind: "scanner-derived";
  location: {
    path: string;
    start: { line: number; column?: number };
    end?: { line: number; column?: number };
  };
  taxonomy: {
    cwe: string[];
    owasp: string[];
    references: string[];
  };
  remediation: {
    summary: string;
    actions: Array<{ title: string; description: string }>;
    verification: { summary: string };
  };
  evidence_refs: string[];
}

export interface Phase3ImportEvidenceRow {
  evidence_id: string;
  kind: "static-analysis" | "dependency";
  provenance_kind: "scanner-derived";
  summary: string;
  classification: "internal";
  artifact_ref: null;
}

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

function buildLocation(finding: HostedPhase3EnvelopeV1["findings"][number]): Phase3ImportFindingRow["location"] {
  const start: { line: number; column?: number } = { line: finding.location.line };
  if (finding.location.startColumn !== undefined) start.column = finding.location.startColumn;

  const location: Phase3ImportFindingRow["location"] = {
    path: finding.location.path,
    start,
  };

  if (finding.location.endColumn !== undefined) {
    location.end = {
      line: finding.location.line,
      column: finding.location.endColumn,
    };
  }

  return location;
}

function derivePersistenceRows(
  assetId: string,
  envelope: HostedPhase3EnvelopeV1,
): { findings: Phase3ImportFindingRow[]; evidence: Phase3ImportEvidenceRow[] } {
  const findings: Phase3ImportFindingRow[] = [];
  const evidenceById = new Map<string, Phase3ImportEvidenceRow>();

  for (const finding of envelope.findings) {
    const source = resolvePhase3Source(finding.scanner, finding.ruleId, finding.ruleVersion);
    const findingId = createHostedFindingIdentity({
      repositoryAssetId: assetId,
      fingerprint: finding.fingerprint,
      scanner: finding.scanner,
      ruleId: finding.ruleId,
      ruleVersion: finding.ruleVersion,
    });
    const evidenceId = createHostedEvidenceIdentity({
      findingId,
      kind: source.evidenceKind,
      classification: source.classification,
      summary: finding.evidence.summary,
    });

    const evidenceRow: Phase3ImportEvidenceRow = {
      evidence_id: evidenceId,
      kind: source.evidenceKind,
      provenance_kind: source.provenanceKind,
      summary: finding.evidence.summary,
      classification: source.classification,
      artifact_ref: source.artifactRef,
    };
    evidenceById.set(evidenceId, evidenceRow);

    findings.push({
      finding_id: findingId,
      source_kind: source.sourceKind,
      source_id: source.sourceId,
      source_version: source.sourceVersion,
      scan_run_ref: envelope.runRef,
      rule_ref: source.ruleRef,
      title: finding.title,
      description: finding.description,
      severity: finding.severity,
      confidence: finding.confidence,
      validation_state: finding.validation,
      provenance_kind: source.provenanceKind,
      location: buildLocation(finding),
      taxonomy: {
        cwe: [...finding.taxonomy.cwe],
        owasp: [...finding.taxonomy.owasp],
        references: [...finding.taxonomy.references],
      },
      remediation: {
        summary: finding.remediation.summary,
        actions: [
          {
            title: "Remediation guidance",
            description: finding.remediation.guidance,
          },
        ],
        verification: { summary: finding.remediation.verification },
      },
      evidence_refs: [evidenceId],
    });
  }

  return { findings, evidence: [...evidenceById.values()] };
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

  const rows = derivePersistenceRows(asset.id, input.envelope);

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
