import type { Finding } from "../../scanner-core/findings/types";
import {
  evidenceId,
  ruleRef,
  securityFindingId,
  type EvidenceKind,
  type EvidenceRecord,
  type RemediationSummary,
  type SecurityConfidence,
  type SecurityFinding,
  type SecuritySeverity,
  type ValidationState,
} from "../../security-domain";

export interface Phase3FindingMapping {
  finding: SecurityFinding;
  evidence: EvidenceRecord[];
}

function mapPhase3Severity(severity: Finding["severity"]): SecuritySeverity {
  switch (severity) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
      return "low";
    case "info":
      return "info";
  }
}

function mapPhase3Confidence(confidence: Finding["confidence"]): SecurityConfidence {
  switch (confidence) {
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
      return "low";
  }
}

export function mapPhase3Validation(validation: Finding["validation"]): ValidationState {
  switch (validation) {
    case "static_confirmed":
    case "dependency_confirmed":
      return "static_confirmed";
    case "heuristic":
    case "informational":
      return "unvalidated";
  }
}

function mapEvidenceKind(validation: Finding["validation"]): EvidenceKind {
  return validation === "dependency_confirmed" ? "dependency" : "static-analysis";
}

function mapRemediation(finding: Finding): RemediationSummary {
  return {
    summary: finding.remediation.summary,
    actions: [
      {
        title: "Remediation guidance",
        description: finding.remediation.guidance,
      },
    ],
    verification: {
      summary: finding.remediation.verification,
    },
  };
}

export function mapPhase3Finding(finding: Finding): Phase3FindingMapping {
  const findingId = securityFindingId(`phase3:${finding.fingerprint}`);
  const mappedEvidenceId = evidenceId(`phase3-evidence:${finding.fingerprint}`);

  const evidence: EvidenceRecord = {
    id: mappedEvidenceId,
    kind: mapEvidenceKind(finding.validation),
    provenance: { kind: "scanner-derived" },
    summary: finding.evidence.summary,
    classification: "internal",
  };

  return {
    finding: {
      id: findingId,
      source: {
        kind: "deterministic-passive-scanner",
        sourceId: `scopeforge:${finding.scanner}:${finding.ruleId}`,
        sourceVersion: finding.ruleVersion,
      },
      rule: ruleRef(`phase3-rule:${finding.ruleId}@${finding.ruleVersion}`),
      title: finding.title,
      description: finding.description,
      severity: mapPhase3Severity(finding.severity),
      confidence: mapPhase3Confidence(finding.confidence),
      validation: mapPhase3Validation(finding.validation),
      provenance: { kind: "scanner-derived" },
      evidenceRefs: [mappedEvidenceId],
      location: {
        path: finding.location.file,
        start: {
          line: finding.location.startLine,
          column: finding.location.startColumn,
        },
        end: {
          line: finding.location.endLine,
          column: finding.location.endColumn,
        },
      },
      taxonomy: {
        cwe: [...finding.cwe],
        owasp: [...finding.owasp],
        references: [...finding.references],
      },
      lifecycle: "open",
      remediation: mapRemediation(finding),
    },
    evidence: [evidence],
  };
}
