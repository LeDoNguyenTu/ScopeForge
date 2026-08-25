import type { Confidence, Severity, Validation } from "../../scanner-core/findings/types";

export interface HostedPhase3FindingLocationV1 {
  path: string;
  line: number;
  startColumn?: number;
  endColumn?: number;
}

export interface HostedPhase3FindingV1 {
  fingerprint: string;
  scanner: string;
  ruleId: string;
  ruleVersion: string;
  title: string;
  description: string;
  severity: Severity;
  confidence: Confidence;
  validation: Validation;
  location: HostedPhase3FindingLocationV1;
  evidence: {
    summary: string;
  };
  taxonomy: {
    cwe: string[];
    owasp: string[];
    references: string[];
  };
  remediation: {
    summary: string;
    guidance: string;
    verification: string;
  };
}

export interface HostedPhase3EnvelopeV1 {
  schemaVersion: 1;
  tool: {
    name: "ScopeForge";
    version: string;
  };
  repository: {
    canonicalUrl: string;
  };
  runRef: string;
  scan: {
    startedAt: string;
    durationMs: number;
    scanners: string[];
    scannerErrorCount: number;
  };
  inventory: {
    filesAnalyzed: number;
    filesSkipped: number;
    totalBytes: number;
  };
  findings: HostedPhase3FindingV1[];
}

export type HostedEvidenceKind = "static-analysis" | "dependency";
export type HostedEvidenceClassification = "internal";
