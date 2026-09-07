import {
  type NormalizedPublicationV1,
  type PublicationBenchmarkProfile,
  type PublicationBenchmarkRun,
  type PublicationBenchmarkSummary,
  type PublicationCaseOutcome,
  type PublicationCounts,
  type PublicationEvidenceV1,
  type PublicationMetrics,
  type PublicationRuleResult,
} from "./contracts";
import { PublicationEvidenceError } from "./error";

function fail(message: string, field?: string): never {
  throw new PublicationEvidenceError("PUBLICATION_EVIDENCE_INCONSISTENT", message, field);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stableRecord(value: Readonly<Record<string, number>>): Readonly<Record<string, number>> {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => compareText(left, right)));
}

function sameRecord(left: Readonly<Record<string, number>>, right: Readonly<Record<string, number>>): boolean {
  return JSON.stringify(stableRecord(left)) === JSON.stringify(stableRecord(right));
}

function emptyCounts(): PublicationCounts {
  return { tp: 0, fn: 0, fp: 0, tn: 0, error: 0, unsupported: 0, contractMismatch: 0 };
}

function addOutcome(counts: PublicationCounts, outcome: PublicationCaseOutcome): void {
  counts[outcome.kind] += 1;
  if (outcome.contractMismatches.length > 0) counts.contractMismatch += 1;
}

function computeMetrics(counts: PublicationCounts): PublicationMetrics {
  const precisionDenominator = counts.tp + counts.fp;
  const recallDenominator = counts.tp + counts.fn;
  const falsePositiveRateDenominator = counts.fp + counts.tn;
  const f1Denominator = (2 * counts.tp) + counts.fp + counts.fn;
  return {
    precision: precisionDenominator === 0 ? null : counts.tp / precisionDenominator,
    recall: recallDenominator === 0 ? null : counts.tp / recallDenominator,
    falsePositiveRate: falsePositiveRateDenominator === 0 ? null : counts.fp / falsePositiveRateDenominator,
    f1: f1Denominator === 0 ? null : (2 * counts.tp) / f1Denominator,
  };
}

function sameCounts(left: PublicationCounts, right: PublicationCounts): boolean {
  return (
    left.tp === right.tp
    && left.fn === right.fn
    && left.fp === right.fp
    && left.tn === right.tn
    && left.error === right.error
    && left.unsupported === right.unsupported
    && left.contractMismatch === right.contractMismatch
  );
}

function sameMetrics(left: PublicationMetrics, right: PublicationMetrics): boolean {
  return (
    left.precision === right.precision
    && left.recall === right.recall
    && left.falsePositiveRate === right.falsePositiveRate
    && left.f1 === right.f1
  );
}

function validateOutcomeSemantics(outcome: PublicationCaseOutcome): void {
  if (outcome.kind === "tp" || outcome.kind === "fn") {
    if (outcome.label !== "vulnerable") fail("TP/FN publication outcomes require vulnerable labels.", `accuracy.cases.${outcome.caseId}`);
  }
  if (outcome.kind === "fp" || outcome.kind === "tn") {
    if (outcome.label !== "clean") fail("FP/TN publication outcomes require clean labels.", `accuracy.cases.${outcome.caseId}`);
  }
  if ((outcome.kind === "error" || outcome.kind === "unsupported") && outcome.diagnosticCodes.length === 0) {
    fail("Error and unsupported publication outcomes require a diagnostic code.", `accuracy.cases.${outcome.caseId}`);
  }
}

function normalizeCase(outcome: PublicationCaseOutcome): PublicationCaseOutcome {
  validateOutcomeSemantics(outcome);
  return {
    ...outcome,
    contractMismatches: [...outcome.contractMismatches].sort(compareText),
    unexpectedRuleIds: [...outcome.unexpectedRuleIds].sort(compareText),
    diagnosticCodes: [...outcome.diagnosticCodes].sort(compareText),
  };
}

function validateAccuracy(evidence: PublicationEvidenceV1): NormalizedPublicationV1["accuracy"] {
  const cases = [...evidence.accuracy.cases]
    .map(normalizeCase)
    .sort((left, right) => compareText(left.caseId, right.caseId));

  if (evidence.accuracy.coverage.totalCases !== cases.length) {
    fail("Publication accuracy coverage count does not match case outcomes.", "accuracy.coverage.totalCases");
  }

  const aggregateCounts = emptyCounts();
  for (const outcome of cases) addOutcome(aggregateCounts, outcome);
  const aggregateMetrics = computeMetrics(aggregateCounts);
  if (!sameCounts(aggregateCounts, evidence.accuracy.aggregate.counts)) {
    fail("Publication aggregate counts do not match case outcomes.", "accuracy.aggregate.counts");
  }
  if (!sameMetrics(aggregateMetrics, evidence.accuracy.aggregate.metrics)) {
    fail("Publication aggregate metrics do not match raw counts.", "accuracy.aggregate.metrics");
  }

  const representedScannerFamilies = [...new Set(cases.map((item) => item.scanner))].sort(compareText);
  const representedRuleIds = [...new Set(cases.map((item) => item.ruleId))].sort(compareText);
  if (JSON.stringify(representedScannerFamilies) !== JSON.stringify([...evidence.accuracy.coverage.representedScannerFamilies].sort(compareText))) {
    fail("Publication scanner-family coverage does not match case outcomes.", "accuracy.coverage.representedScannerFamilies");
  }
  if (JSON.stringify(representedRuleIds) !== JSON.stringify([...evidence.accuracy.coverage.representedRuleIds].sort(compareText))) {
    fail("Publication rule coverage does not match case outcomes.", "accuracy.coverage.representedRuleIds");
  }

  const rules: PublicationRuleResult[] = [...evidence.accuracy.rules]
    .sort((left, right) => compareText(left.ruleId, right.ruleId))
    .map((rule) => {
      const ruleCases = cases.filter((item) => item.ruleId === rule.ruleId);
      if (ruleCases.length === 0 || ruleCases.some((item) => item.scanner !== rule.scanner)) {
        return fail("Publication rule identity does not match case outcomes.", `accuracy.rules.${rule.ruleId}`);
      }
      const caseIds = ruleCases.map((item) => item.caseId).sort(compareText);
      if (JSON.stringify(caseIds) !== JSON.stringify([...rule.caseIds].sort(compareText))) {
        return fail("Publication rule case identities do not match case outcomes.", `accuracy.rules.${rule.ruleId}.caseIds`);
      }
      const ruleCounts = emptyCounts();
      for (const outcome of ruleCases) addOutcome(ruleCounts, outcome);
      const ruleMetrics = computeMetrics(ruleCounts);
      if (!sameCounts(ruleCounts, rule.counts)) {
        return fail("Publication rule counts do not match case outcomes.", `accuracy.rules.${rule.ruleId}.counts`);
      }
      if (!sameMetrics(ruleMetrics, rule.metrics)) {
        return fail("Publication rule metrics do not match raw counts.", `accuracy.rules.${rule.ruleId}.metrics`);
      }
      return {
        ...rule,
        caseIds,
        counts: ruleCounts,
        metrics: ruleMetrics,
      };
    });

  if (rules.length !== representedRuleIds.length || JSON.stringify(rules.map((item) => item.ruleId)) !== JSON.stringify(representedRuleIds)) {
    fail("Publication rule result set does not match represented rule coverage.", "accuracy.rules");
  }

  return {
    ...evidence.accuracy,
    coverage: {
      totalCases: cases.length,
      representedScannerFamilies: representedScannerFamilies as ("iac" | "jsts" | "secrets")[],
      representedRuleIds,
    },
    aggregate: { counts: aggregateCounts, metrics: aggregateMetrics },
    rules,
    cases,
  };
}

function summary(runs: readonly PublicationBenchmarkRun[]): PublicationBenchmarkSummary {
  if (runs.length !== 3) fail("Phase 8B benchmark publication requires exactly three raw runs.", "performance.profiles.runs");
  const wall = runs.map((item) => item.wallMs).sort((left, right) => left - right);
  const scanner = runs.map((item) => item.scanDurationMs).sort((left, right) => left - right);
  const rss = runs.map((item) => item.rssDeltaBytes).sort((left, right) => left - right);
  return {
    minWallMs: wall[0]!,
    medianWallMs: wall[1]!,
    maxWallMs: wall[2]!,
    medianScanDurationMs: scanner[1]!,
    maxRssDeltaBytes: rss[2]!,
  };
}

function sameSummary(left: PublicationBenchmarkSummary, right: PublicationBenchmarkSummary): boolean {
  return (
    left.minWallMs === right.minWallMs
    && left.medianWallMs === right.medianWallMs
    && left.maxWallMs === right.maxWallMs
    && left.medianScanDurationMs === right.medianScanDurationMs
    && left.maxRssDeltaBytes === right.maxRssDeltaBytes
  );
}

const RELEASED_PROFILE_CONTRACTS = Object.freeze({
  "dependency-lockfile-heavy-v1": {
    scanner: "sca",
    expectedFiles: 3,
    expectedFindingRuleCounts: {},
    expectedErrors: 0,
    maxWallMs: 20_000,
  },
  "iac-heavy-v1": {
    scanner: "iac",
    expectedFiles: 601,
    expectedFindingRuleCounts: {
      "iac/docker-floating-base-image": 1,
      "iac/github-actions-write-all-permissions": 1,
      "iac/kubernetes-privileged-container": 1,
      "iac/terraform-aws-public-rds": 1,
    },
    expectedErrors: 0,
    maxWallMs: 30_000,
  },
  "source-ast-heavy-v1": {
    scanner: "jsts",
    expectedFiles: 1_201,
    expectedFindingRuleCounts: { "jsts/dynamic-code-execution": 4 },
    expectedErrors: 0,
    maxWallMs: 30_000,
  },
} as const);

function validateReleasedProfileDefinition(profile: PublicationBenchmarkProfile): void {
  const contract = RELEASED_PROFILE_CONTRACTS[profile.id as keyof typeof RELEASED_PROFILE_CONTRACTS];
  if (!contract) fail("Publication contains a benchmark profile outside the released Phase 8B matrix.", `performance.profiles.${profile.id}`);
  if (
    profile.scanner !== contract.scanner
    || profile.expectedFiles !== contract.expectedFiles
    || profile.expectedErrors !== contract.expectedErrors
    || profile.maxWallMs !== contract.maxWallMs
    || !sameRecord(profile.expectedFindingRuleCounts, contract.expectedFindingRuleCounts)
  ) {
    fail("Publication benchmark profile definition does not match the released Phase 8B contract.", `performance.profiles.${profile.id}`);
  }

  if (profile.id === "dependency-lockfile-heavy-v1") {
    if (
      profile.preflight.kind !== "dependency-lockfile"
      || profile.preflight.resolvedComponents !== 5_000
      || profile.preflight.parserDiagnostics !== 0
      || profile.preflight.osvEnabled !== false
    ) {
      fail("Dependency benchmark preflight metadata does not match the released Phase 8B contract.", `performance.profiles.${profile.id}.preflight`);
    }
  } else if (profile.preflight.kind !== "none") {
    fail("Released IaC/source benchmark profiles do not define a separate preflight contract.", `performance.profiles.${profile.id}.preflight`);
  }
}

function validateRun(profile: PublicationBenchmarkProfile, run: PublicationBenchmarkRun, index: number): PublicationBenchmarkRun {
  if (run.run !== index + 1) fail("Benchmark raw run identities must be exactly 1, 2, 3.", `performance.profiles.${profile.id}.runs`);
  if (run.filesAnalyzed !== profile.expectedFiles) fail("Benchmark raw run changed analyzed-file count.", `performance.profiles.${profile.id}.runs[${index}]`);
  if (run.errors !== profile.expectedErrors) fail("Benchmark raw run changed scanner-error count.", `performance.profiles.${profile.id}.runs[${index}]`);
  if (!sameRecord(run.findingRuleCounts, profile.expectedFindingRuleCounts)) {
    fail("Benchmark raw run changed expected finding rule counts.", `performance.profiles.${profile.id}.runs[${index}]`);
  }
  const findings = Object.values(run.findingRuleCounts).reduce((total, count) => total + count, 0);
  if (run.findings !== findings) fail("Benchmark raw run finding total does not match its rule counts.", `performance.profiles.${profile.id}.runs[${index}]`);
  if (run.wallMs > profile.maxWallMs) fail("Benchmark raw run exceeds its catastrophic regression guard.", `performance.profiles.${profile.id}.runs[${index}]`);
  return { ...run, findingRuleCounts: stableRecord(run.findingRuleCounts) };
}

function normalizeProfile(profile: PublicationBenchmarkProfile): PublicationBenchmarkProfile {
  validateReleasedProfileDefinition(profile);
  const runs = profile.runs.map((run, index) => validateRun(profile, run, index));
  const recomputed = summary(runs);
  if (!sameSummary(recomputed, profile.summary)) {
    fail("Benchmark summary does not reproduce from retained raw runs.", `performance.profiles.${profile.id}.summary`);
  }
  return {
    ...profile,
    expectedFindingRuleCounts: stableRecord(profile.expectedFindingRuleCounts),
    runs,
    summary: recomputed,
  };
}

function normalizePerformance(evidence: PublicationEvidenceV1): NormalizedPublicationV1["performance"] {
  if (evidence.performance.historical.wallMs > evidence.performance.historical.maxWallMs) {
    fail("Historical benchmark evidence exceeds its recorded catastrophic regression guard.", "performance.historical.wallMs");
  }
  const profiles = [...evidence.performance.profiles]
    .sort((left, right) => compareText(left.id, right.id))
    .map(normalizeProfile);
  const expectedIds = Object.keys(RELEASED_PROFILE_CONTRACTS).sort(compareText);
  if (JSON.stringify(profiles.map((item) => item.id)) !== JSON.stringify(expectedIds)) {
    fail("Publication must retain all three released Phase 8B matrix profiles.", "performance.profiles");
  }
  return { ...evidence.performance, profiles };
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}

export function normalizePublicationEvidence(evidence: PublicationEvidenceV1): NormalizedPublicationV1 {
  return deepFreeze({
    ...evidence,
    accuracy: validateAccuracy(evidence),
    performance: normalizePerformance(evidence),
    limitations: [...evidence.limitations].sort(compareText),
    unsupportedScenarios: [...evidence.unsupportedScenarios].sort(compareText),
  });
}
