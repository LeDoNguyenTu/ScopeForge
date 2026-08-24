import type { RepositoryInventorySummary } from "../inventory/types";

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Confidence = "high" | "medium" | "low";
export type Validation =
  | "static_confirmed"
  | "dependency_confirmed"
  | "heuristic"
  | "informational";
export type Provenance = "observed" | "enriched" | "inferred";
export type BaselineState = "new" | "existing" | "none";
export type BaselineGate = "new" | "all";

export interface FindingLocation {
  file: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface DataFlowStep {
  file: string;
  line: number;
  label: string;
}

export interface FindingEvidence {
  summary: string;
  redactedSnippet?: string;
  dataFlow?: DataFlowStep[];
}

export interface FindingRemediation {
  summary: string;
  guidance: string;
  verification: string;
}

export interface Finding {
  id: string;
  fingerprint: string;
  scanner: string;
  ruleId: string;
  ruleVersion: string;
  title: string;
  description: string;
  severity: Severity;
  confidence: Confidence;
  category: string;
  validation: Validation;
  provenance: Provenance;
  location: FindingLocation;
  evidence: FindingEvidence;
  cwe: string[];
  owasp: string[];
  references: string[];
  remediation: FindingRemediation;
  metadata: Record<string, unknown>;
  firstSeen?: string;
  baselineState: BaselineState;
}

export interface ScanError {
  scanner: string;
  code?: string;
  file?: string;
  message: string;
}

export interface ScanPolicyResult {
  mode: "report-only" | "enforce";
  passed: boolean;
  failOn?: Severity;
  baselineGate?: BaselineGate;
}

export interface ScanMetadata {
  root: string;
  startedAt: string;
  durationMs: number;
  scanners: string[];
}

export interface ScanResult {
  scan: ScanMetadata;
  inventory: RepositoryInventorySummary;
  findings: Finding[];
  errors: ScanError[];
  policy: ScanPolicyResult;
}
