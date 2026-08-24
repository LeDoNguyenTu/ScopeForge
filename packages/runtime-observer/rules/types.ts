import type {
  ContentClassification,
  EvidenceKind,
  RemediationSummary,
  SecurityConfidence,
  SecuritySeverity,
} from "@/packages/security-domain";

export interface RuntimeRuleMatch {
  ruleId: string;
  observationKey: string;
  title: string;
  description: string;
  severity: SecuritySeverity;
  confidence: SecurityConfidence;
  evidenceSummary: string;
  evidenceKind: Extract<EvidenceKind, "http-observation" | "tls-observation">;
  classification: ContentClassification;
  remediation: RemediationSummary;
}
