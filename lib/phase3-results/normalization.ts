import {
  createHostedEvidenceIdentity,
  createHostedFindingIdentity,
} from "@/packages/scanner-output/hosted/identity";
import type { HostedPhase3EnvelopeV1 } from "@/packages/scanner-output/hosted/types";
import { resolvePhase3Source } from "./source-registry";

export interface HostedPhase3FindingRow {
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

export interface HostedPhase3EvidenceRow {
  evidence_id: string;
  kind: "static-analysis" | "dependency";
  provenance_kind: "scanner-derived";
  summary: string;
  classification: "internal";
  artifact_ref: null;
}

export interface HostedPhase3PersistenceRows {
  findings: HostedPhase3FindingRow[];
  evidence: HostedPhase3EvidenceRow[];
}

function buildLocation(
  finding: HostedPhase3EnvelopeV1["findings"][number],
): HostedPhase3FindingRow["location"] {
  const start: { line: number; column?: number } = { line: finding.location.line };
  if (finding.location.startColumn !== undefined) start.column = finding.location.startColumn;

  const location: HostedPhase3FindingRow["location"] = {
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

export function deriveHostedPhase3PersistenceRows(
  assetId: string,
  envelope: HostedPhase3EnvelopeV1,
): HostedPhase3PersistenceRows {
  const findings: HostedPhase3FindingRow[] = [];
  const evidenceById = new Map<string, HostedPhase3EvidenceRow>();

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

    evidenceById.set(evidenceId, {
      evidence_id: evidenceId,
      kind: source.evidenceKind,
      provenance_kind: source.provenanceKind,
      summary: finding.evidence.summary,
      classification: source.classification,
      artifact_ref: source.artifactRef,
    });

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