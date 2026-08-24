import type {
  ContentClassification,
  EvidenceKind,
  RemediationSummary,
  SecurityConfidence,
  SecuritySeverity,
} from "@/packages/security-domain";

export interface ActiveRuntimeRuleMatch {
  ruleId: string;
  observationKey: string;
  title: string;
  description: string;
  severity: SecuritySeverity;
  confidence: SecurityConfidence;
  evidenceSummary: string;
  evidenceKind: Extract<EvidenceKind, "http-observation">;
  classification: ContentClassification;
  remediation: RemediationSummary;
}
