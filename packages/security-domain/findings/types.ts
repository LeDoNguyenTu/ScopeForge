import type {
  AssetRef,
  EvidenceId,
  RuleRef,
  SecurityFindingId,
} from "../common/identifiers";
import type { SecurityConfidence, SecuritySeverity } from "../common/security-levels";
import type { ProvenanceRecord } from "../provenance/types";
import type { RemediationSummary } from "../remediation/types";
import type { FindingSourceRef } from "../sources/types";
import type { ValidationState } from "../validation/types";

export type FindingLifecycleState =
  | "open"
  | "acknowledged"
  | "in_progress"
  | "resolved"
  | "retest_pending"
  | "verified_fixed"
  | "accepted_risk"
  | "false_positive";

export interface SecurityPosition {
  line: number;
  column: number;
}

export interface SecurityLocation {
  path: string;
  start?: SecurityPosition;
  end?: SecurityPosition;
}

export interface TaxonomyReferences {
  cwe: readonly string[];
  owasp: readonly string[];
  references: readonly string[];
}

export interface SecurityFinding {
  id: SecurityFindingId;
  source: FindingSourceRef;
  rule: RuleRef;
  title: string;
  description: string;
  severity: SecuritySeverity;
  confidence: SecurityConfidence;
  validation: ValidationState;
  provenance: ProvenanceRecord;
  evidenceRefs: readonly EvidenceId[];
  assetRef?: AssetRef;
  location?: SecurityLocation;
  taxonomy: TaxonomyReferences;
  lifecycle: FindingLifecycleState;
  remediation?: RemediationSummary;
}
