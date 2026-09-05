import type { Confidence, Severity } from "../scanner-core/findings/types";

export const VALIDATION_ACCURACY_LIMITS = Object.freeze({
  manifestBytes: 64 * 1024,
  corpusCases: 256,
  expectedFilesPerPositiveCase: 16,
  rationaleBytes: 4 * 1024,
  notesBytes: 4 * 1024,
  diagnosticBytes: 512,
  repositoryFilesPerCase: 128,
  repositoryFileBytes: 2 * 1024 * 1024,
  repositoryBytesPerCase: 8 * 1024 * 1024,
});

export type ValidationScannerFamily = "secrets" | "jsts" | "iac";
export type ValidationCaseLabel = "vulnerable" | "clean";
export type ValidationCaseOutcomeKind = "tp" | "fn" | "fp" | "tn" | "error" | "unsupported";
export type ValidationContractMismatch = "confidence" | "cwe" | "severity";

export interface ValidationCaseV1 {
  schemaVersion: 1;
  caseId: string;
  scanner: ValidationScannerFamily;
  ruleId: string;
  label: ValidationCaseLabel;
  repository: "repository";
  rationale: string;
  expectedFiles: readonly string[];
  expectedSeverity?: Severity;
  expectedConfidence?: Confidence;
  expectedCwe?: readonly string[];
  remediationOf?: string;
  notes?: string;
}

export interface ValidationCorpusV1 {
  schemaVersion: 1;
  corpusId: string;
  corpusVersion: string;
  cases: readonly string[];
}

export interface LoadedValidationCase {
  caseDirectory: string;
  repositoryDirectory: string;
  manifestPath: string;
  manifest: ValidationCaseV1;
}

export interface LoadedValidationCorpus {
  corpusDirectory: string;
  manifestPath: string;
  manifest: ValidationCorpusV1;
  cases: readonly LoadedValidationCase[];
  contentHash: string;
}

export interface ValidationCaseOutcome {
  caseId: string;
  scanner: ValidationScannerFamily;
  ruleId: string;
  label: ValidationCaseLabel;
  kind: ValidationCaseOutcomeKind;
  contractMismatches: readonly ValidationContractMismatch[];
  unexpectedRuleIds: readonly string[];
  diagnosticCodes: readonly string[];
}

export interface ValidationCounts {
  tp: number;
  fn: number;
  fp: number;
  tn: number;
  error: number;
  unsupported: number;
  contractMismatch: number;
}

export interface ValidationDerivedMetrics {
  precision: number | null;
  recall: number | null;
  falsePositiveRate: number | null;
  f1: number | null;
}

export interface ValidationProvenance {
  scopeforgeVersion: string;
  commitSha: string;
  nodeVersion: string;
  platform: string;
  arch: string;
}

export interface ValidationRuleResult {
  scanner: ValidationScannerFamily;
  ruleId: string;
  ruleVersion: string;
  caseIds: readonly string[];
  counts: ValidationCounts;
  metrics: ValidationDerivedMetrics;
}

export interface ValidationCoverage {
  totalCases: number;
  representedScannerFamilies: readonly ValidationScannerFamily[];
  representedRuleIds: readonly string[];
}

export interface ValidationAccuracyResult {
  schemaVersion: 1;
  provenance: ValidationProvenance;
  corpus: {
    id: string;
    version: string;
    contentHash: string;
  };
  coverage: ValidationCoverage;
  aggregate: {
    counts: ValidationCounts;
    metrics: ValidationDerivedMetrics;
  };
  rules: readonly ValidationRuleResult[];
  cases: readonly ValidationCaseOutcome[];
  interpretation: "Metrics describe only the committed covered corpus and are not global ScopeForge accuracy.";
}

export type ValidationAccuracyErrorCode =
  | "VALIDATION_PATH_INVALID"
  | "VALIDATION_CORPUS_INVALID"
  | "VALIDATION_CASE_INVALID"
  | "VALIDATION_MANIFEST_TOO_LARGE"
  | "VALIDATION_BUDGET_EXCEEDED"
  | "VALIDATION_REPOSITORY_UNSAFE"
  | "VALIDATION_RULE_INVALID"
  | "VALIDATION_EVALUATION_ERROR"
  | "VALIDATION_OUTPUT_INVALID";
