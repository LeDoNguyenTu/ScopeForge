import type {
  Database,
  SecurityFindingRetestRow,
  SecurityFindingRow,
  SecurityFindingWorkRow,
  WorkspaceRole,
} from "@/lib/database.types";

type SecurityEvidenceRow = Database["public"]["Tables"]["security_evidence"]["Row"];
type SecurityFindingOccurrenceRow = Database["public"]["Tables"]["security_finding_occurrences"]["Row"];
type SecurityFindingEventRow = Database["public"]["Tables"]["security_finding_events"]["Row"];

export type RetestExecutionKind = "passive_runtime" | "active_validation";

export interface RetestSourceDescriptor {
  executionKind: RetestExecutionKind;
  sourceId: string;
  sourceVersion: string | null;
  validationProfileId: "cors-origin-policy" | null;
  validationProfileVersion: 1 | null;
}

export type SecurityRemediationErrorCode =
  | "SECURITY_REMEDIATION_FORBIDDEN"
  | "SECURITY_REMEDIATION_ASSIGNEE_INVALID"
  | "SECURITY_REMEDIATION_NOTE_INVALID"
  | "SECURITY_REMEDIATION_FINDING_NOT_AVAILABLE"
  | "SECURITY_RETEST_UNSUPPORTED_SOURCE"
  | "SECURITY_RETEST_CONSENT_REQUIRED"
  | "SECURITY_RETEST_FORBIDDEN"
  | "SECURITY_RETEST_STATE_INVALID"
  | "SECURITY_RETEST_ACTIVE_CONFLICT"
  | "SECURITY_RETEST_NOT_AVAILABLE"
  | "SECURITY_RETEST_JOB_INVALID"
  | "SECURITY_RETEST_FINALIZATION_INVALID"
  | "SECURITY_RETEST_EXECUTION_FAILED";

const SAFE_REASONS: Readonly<Record<SecurityRemediationErrorCode, string>> = Object.freeze({
  SECURITY_REMEDIATION_FORBIDDEN: "Your workspace role cannot change this remediation workflow.",
  SECURITY_REMEDIATION_ASSIGNEE_INVALID: "The selected assignee is not available for this workspace.",
  SECURITY_REMEDIATION_NOTE_INVALID: "The remediation note must be at most 2000 characters.",
  SECURITY_REMEDIATION_FINDING_NOT_AVAILABLE: "The security finding is not available in this workspace.",
  SECURITY_RETEST_UNSUPPORTED_SOURCE: "This finding does not have a supported deterministic retest source.",
  SECURITY_RETEST_CONSENT_REQUIRED: "Active validation requires explicit consent.",
  SECURITY_RETEST_FORBIDDEN: "Your workspace role cannot run this finding retest.",
  SECURITY_RETEST_STATE_INVALID: "The finding is not currently eligible for a retest.",
  SECURITY_RETEST_ACTIVE_CONFLICT: "Another retest is already active for this finding.",
  SECURITY_RETEST_NOT_AVAILABLE: "The finding retest is not available in this workspace.",
  SECURITY_RETEST_JOB_INVALID: "The runtime job cannot be attached to this retest.",
  SECURITY_RETEST_FINALIZATION_INVALID: "The finding retest cannot be finalized from its current state.",
  SECURITY_RETEST_EXECUTION_FAILED: "The finding retest could not be started safely.",
});

export class SecurityRemediationWorkflowError extends Error {
  readonly code: SecurityRemediationErrorCode;
  readonly reason: string;

  constructor(code: SecurityRemediationErrorCode) {
    super(SAFE_REASONS[code]);
    this.name = "SecurityRemediationWorkflowError";
    this.code = code;
    this.reason = SAFE_REASONS[code];
  }
}

export interface UpdateFindingWorkInput {
  actorId: string;
  workspaceId: string;
  role: WorkspaceRole;
  findingId: string;
  assigneeUserId: string | null;
  remediationNote: string | null;
}

export interface RequestFindingRetestInput {
  actorId: string;
  workspaceId: string;
  role: WorkspaceRole;
  findingId: string;
  explicitConsent: boolean;
}

export interface SecurityStoryInput {
  finding: SecurityFindingRow;
  evidence: readonly SecurityEvidenceRow[];
  occurrences: readonly SecurityFindingOccurrenceRow[];
  events: readonly SecurityFindingEventRow[];
  work: SecurityFindingWorkRow | null;
  retests: readonly SecurityFindingRetestRow[];
}

export interface SecurityStoryEvidenceItem {
  evidenceId: string;
  kind: string;
  summary: string;
  classification: string;
  provenanceLabel: string;
}

export interface SecurityStoryRemediation {
  guidance: string;
  assigneeUserId: string | null;
  note: string | null;
  provenanceLabel: string;
}

export interface SecurityStoryVerification {
  status: SecurityFindingRetestRow["status"] | "not_run";
  verified: boolean;
  latestRetestId: string | null;
  resultCode: string | null;
  provenanceLabel: string;
  summary: string;
}

export interface SecurityStoryV1 {
  summary: string;
  evidence: readonly SecurityStoryEvidenceItem[];
  impact: string;
  remediation: SecurityStoryRemediation;
  verification: SecurityStoryVerification;
}
