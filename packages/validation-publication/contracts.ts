export const PUBLICATION_EVIDENCE_LIMITS = Object.freeze({
  evidenceBytes: 512 * 1024,
  narrativeBytes: 4 * 1024,
  listItems: 256,
  profiles: 16,
  rules: 256,
  cases: 1024,
});

export type PublicationEvidenceErrorCode =
  | "PUBLICATION_EVIDENCE_INVALID"
  | "PUBLICATION_OUTPUT_INVALID"
  | "PUBLICATION_EVIDENCE_INCONSISTENT";

export interface PublicationCounts {
  tp: number;
  fn: number;
  fp: number;
  tn: number;
  error: number;
  unsupported: number;
  contractMismatch: number;
}

export interface PublicationMetrics {
  precision: number | null;
  recall: number | null;
  falsePositiveRate: number | null;
  f1: number | null;
}

export interface PublicationCaseOutcome {
  caseId: string;
  scanner: "secrets" | "jsts" | "iac";
  ruleId: string;
  label: "vulnerable" | "clean";
  kind: "tp" | "fn" | "fp" | "tn" | "error" | "unsupported";
  contractMismatches: readonly string[];
  unexpectedRuleIds: readonly string[];
  diagnosticCodes: readonly string[];
}

export interface PublicationRuleResult {
  scanner: "secrets" | "jsts" | "iac";
  ruleId: string;
  ruleVersion: string;
  caseIds: readonly string[];
  counts: PublicationCounts;
  metrics: PublicationMetrics;
}

export interface PublicationAccuracyEvidence {
  resultSchemaVersion: 1;
  corpus: {
    id: string;
    version: string;
    contentHash: string;
  };
  coverage: {
    totalCases: number;
    representedScannerFamilies: readonly ("secrets" | "jsts" | "iac")[];
    representedRuleIds: readonly string[];
  };
  aggregate: {
    counts: PublicationCounts;
    metrics: PublicationMetrics;
  };
  rules: readonly PublicationRuleResult[];
  cases: readonly PublicationCaseOutcome[];
  interpretation: string;
}

export interface PublicationBenchmarkRun {
  run: number;
  filesAnalyzed: number;
  findings: number;
  errors: number;
  findingRuleCounts: Readonly<Record<string, number>>;
  scanDurationMs: number;
  wallMs: number;
  rssDeltaBytes: number;
}

export interface PublicationBenchmarkSummary {
  minWallMs: number;
  medianWallMs: number;
  maxWallMs: number;
  medianScanDurationMs: number;
  maxRssDeltaBytes: number;
}

export type PublicationBenchmarkPreflight =
  | { kind: "none" }
  | {
      kind: "dependency-lockfile";
      resolvedComponents: number;
      parserDiagnostics: number;
      osvEnabled: false;
    };

export interface PublicationBenchmarkProfile {
  id: string;
  scanner: "sca" | "iac" | "jsts";
  expectedFiles: number;
  expectedFindingRuleCounts: Readonly<Record<string, number>>;
  expectedErrors: number;
  maxWallMs: number;
  preflight: PublicationBenchmarkPreflight;
  runs: readonly PublicationBenchmarkRun[];
  summary: PublicationBenchmarkSummary;
}

export interface PublicationPerformanceEvidence {
  benchmarkSchemaVersion: 1;
  runsPerProfile: 3;
  environment: {
    nodeVersion: string;
    os: string;
    platform: string;
    arch: string;
  };
  historical: {
    fixture: "scanner-medium-v1";
    filesAnalyzed: number;
    findings: number;
    errors: number;
    scanDurationMs: number;
    wallMs: number;
    rssDeltaBytes: number;
    maxWallMs: number;
  };
  profiles: readonly PublicationBenchmarkProfile[];
}

export interface PublicationSourceIdentity {
  repository: string;
  phase8aCommit: string;
  phase8aTree?: string;
  phase8bCommit: string;
  phase8bTree: string;
  scopeforgeVersion: string;
}

export interface ResolvedPublicationSourceIdentity extends PublicationSourceIdentity {
  phase8aTree: string;
}

export interface PublicationClaimBoundaries {
  accuracyScope: string;
  unmeasuredScope: string;
  exceptionalOutcomes: string;
  benchmarkScope: string;
  latency: string;
  timing: string;
  memory: string;
  authority: string;
}

export interface PublicationReproduction {
  install: string;
  build: string;
  render: string;
  accuracy: string;
  benchmark: string;
}

export interface PublicationEvidenceV1 {
  schemaVersion: 1;
  publicationId: string;
  source: PublicationSourceIdentity;
  accuracy: PublicationAccuracyEvidence;
  performance: PublicationPerformanceEvidence;
  limitations: readonly string[];
  unsupportedScenarios: readonly string[];
  claimBoundaries: PublicationClaimBoundaries;
  reproduction: PublicationReproduction;
}

export interface ResolvedPublicationEvidenceV1 extends Omit<PublicationEvidenceV1, "source"> {
  source: ResolvedPublicationSourceIdentity;
}

export interface NormalizedPublicationV1 extends ResolvedPublicationEvidenceV1 {
  schemaVersion: 1;
}
