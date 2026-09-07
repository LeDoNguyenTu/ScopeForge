import { parseDocument } from "yaml";

import {
  PUBLICATION_EVIDENCE_LIMITS,
  type PublicationAccuracyEvidence,
  type PublicationBenchmarkPreflight,
  type PublicationBenchmarkProfile,
  type PublicationBenchmarkRun,
  type PublicationBenchmarkSummary,
  type PublicationCaseOutcome,
  type PublicationClaimBoundaries,
  type PublicationCounts,
  type PublicationEvidenceV1,
  type PublicationMetrics,
  type PublicationPerformanceEvidence,
  type PublicationReproduction,
  type PublicationRuleResult,
  type PublicationSourceIdentity,
} from "./contracts";
import { PublicationEvidenceError } from "./error";

function fail(message: string, field?: string): never {
  throw new PublicationEvidenceError("PUBLICATION_EVIDENCE_INVALID", message, field);
}

function exactObject(value: unknown, keys: readonly string[], field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail("Publication evidence field must be an object.", field);
  }
  const object = value as Record<string, unknown>;
  const actual = Object.keys(object).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    return fail("Publication evidence object contains missing or unknown fields.", field);
  }
  return object;
}

function boundedString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    return fail("Publication evidence field must be a non-empty string.", field);
  }
  if (Buffer.byteLength(value, "utf8") > PUBLICATION_EVIDENCE_LIMITS.narrativeBytes) {
    return fail("Publication evidence string exceeds its fixed byte budget.", field);
  }
  if (/\u0000|[\u202a-\u202e\u2066-\u2069]/u.test(value)) {
    return fail("Publication evidence string contains disallowed control text.", field);
  }
  return value;
}

function gitIdentity(value: unknown, field: string): string {
  const text = boundedString(value, field);
  if (!/^[a-f0-9]{40}$/u.test(text)) {
    return fail("Publication evidence Git identity must be a lowercase 40-hex value.", field);
  }
  return text;
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return fail("Publication evidence numeric field must be a non-negative safe integer.", field);
  }
  return value as number;
}

function metricValue(value: unknown, field: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    return fail("Publication evidence metric must be null or a finite number from zero to one.", field);
  }
  return value;
}

function boundedArray(value: unknown, field: string, max = PUBLICATION_EVIDENCE_LIMITS.listItems): unknown[] {
  if (!Array.isArray(value) || value.length > max) {
    return fail("Publication evidence array is invalid or exceeds its item budget.", field);
  }
  return value;
}

function stringArray(value: unknown, field: string): readonly string[] {
  const items = boundedArray(value, field).map((item, index) => boundedString(item, `${field}[${index}]`));
  if (new Set(items).size !== items.length) return fail("Publication evidence list contains duplicate values.", field);
  return items;
}

function counts(value: unknown, field: string): PublicationCounts {
  const object = exactObject(value, ["tp", "fn", "fp", "tn", "error", "unsupported", "contractMismatch"], field);
  return {
    tp: nonNegativeInteger(object.tp, `${field}.tp`),
    fn: nonNegativeInteger(object.fn, `${field}.fn`),
    fp: nonNegativeInteger(object.fp, `${field}.fp`),
    tn: nonNegativeInteger(object.tn, `${field}.tn`),
    error: nonNegativeInteger(object.error, `${field}.error`),
    unsupported: nonNegativeInteger(object.unsupported, `${field}.unsupported`),
    contractMismatch: nonNegativeInteger(object.contractMismatch, `${field}.contractMismatch`),
  };
}

function metrics(value: unknown, field: string): PublicationMetrics {
  const object = exactObject(value, ["precision", "recall", "falsePositiveRate", "f1"], field);
  return {
    precision: metricValue(object.precision, `${field}.precision`),
    recall: metricValue(object.recall, `${field}.recall`),
    falsePositiveRate: metricValue(object.falsePositiveRate, `${field}.falsePositiveRate`),
    f1: metricValue(object.f1, `${field}.f1`),
  };
}

function scannerFamily(value: unknown, field: string): "secrets" | "jsts" | "iac" {
  if (value !== "secrets" && value !== "jsts" && value !== "iac") {
    return fail("Publication evidence scanner family is unsupported.", field);
  }
  return value;
}

function caseOutcome(value: unknown, index: number): PublicationCaseOutcome {
  const field = `accuracy.cases[${index}]`;
  const object = exactObject(value, [
    "caseId", "scanner", "ruleId", "label", "kind", "contractMismatches", "unexpectedRuleIds", "diagnosticCodes",
  ], field);
  if (object.label !== "vulnerable" && object.label !== "clean") return fail("Publication case label is invalid.", `${field}.label`);
  if (!["tp", "fn", "fp", "tn", "error", "unsupported"].includes(String(object.kind))) {
    return fail("Publication case outcome is invalid.", `${field}.kind`);
  }
  return {
    caseId: boundedString(object.caseId, `${field}.caseId`),
    scanner: scannerFamily(object.scanner, `${field}.scanner`),
    ruleId: boundedString(object.ruleId, `${field}.ruleId`),
    label: object.label,
    kind: object.kind as PublicationCaseOutcome["kind"],
    contractMismatches: stringArray(object.contractMismatches, `${field}.contractMismatches`),
    unexpectedRuleIds: stringArray(object.unexpectedRuleIds, `${field}.unexpectedRuleIds`),
    diagnosticCodes: stringArray(object.diagnosticCodes, `${field}.diagnosticCodes`),
  };
}

function ruleResult(value: unknown, index: number): PublicationRuleResult {
  const field = `accuracy.rules[${index}]`;
  const object = exactObject(value, ["scanner", "ruleId", "ruleVersion", "caseIds", "counts", "metrics"], field);
  return {
    scanner: scannerFamily(object.scanner, `${field}.scanner`),
    ruleId: boundedString(object.ruleId, `${field}.ruleId`),
    ruleVersion: boundedString(object.ruleVersion, `${field}.ruleVersion`),
    caseIds: stringArray(object.caseIds, `${field}.caseIds`),
    counts: counts(object.counts, `${field}.counts`),
    metrics: metrics(object.metrics, `${field}.metrics`),
  };
}

function accuracy(value: unknown): PublicationAccuracyEvidence {
  const object = exactObject(value, ["resultSchemaVersion", "corpus", "coverage", "aggregate", "rules", "cases", "interpretation"], "accuracy");
  if (object.resultSchemaVersion !== 1) return fail("Publication accuracy result schema is unsupported.", "accuracy.resultSchemaVersion");
  const corpus = exactObject(object.corpus, ["id", "version", "contentHash"], "accuracy.corpus");
  const coverage = exactObject(object.coverage, ["totalCases", "representedScannerFamilies", "representedRuleIds"], "accuracy.coverage");
  const aggregate = exactObject(object.aggregate, ["counts", "metrics"], "accuracy.aggregate");
  const scannerValues = boundedArray(coverage.representedScannerFamilies, "accuracy.coverage.representedScannerFamilies")
    .map((item, index) => scannerFamily(item, `accuracy.coverage.representedScannerFamilies[${index}]`));
  const rules = boundedArray(object.rules, "accuracy.rules", PUBLICATION_EVIDENCE_LIMITS.rules).map(ruleResult);
  const cases = boundedArray(object.cases, "accuracy.cases", PUBLICATION_EVIDENCE_LIMITS.cases).map(caseOutcome);
  if (new Set(rules.map((item) => item.ruleId)).size !== rules.length) return fail("Publication accuracy rules contain duplicate identities.", "accuracy.rules");
  if (new Set(cases.map((item) => item.caseId)).size !== cases.length) return fail("Publication accuracy cases contain duplicate identities.", "accuracy.cases");
  return {
    resultSchemaVersion: 1,
    corpus: {
      id: boundedString(corpus.id, "accuracy.corpus.id"),
      version: boundedString(corpus.version, "accuracy.corpus.version"),
      contentHash: (() => {
        const hash = boundedString(corpus.contentHash, "accuracy.corpus.contentHash");
        if (!/^[a-f0-9]{64}$/u.test(hash)) return fail("Publication corpus hash must be lowercase SHA-256 hex.", "accuracy.corpus.contentHash");
        return hash;
      })(),
    },
    coverage: {
      totalCases: nonNegativeInteger(coverage.totalCases, "accuracy.coverage.totalCases"),
      representedScannerFamilies: scannerValues,
      representedRuleIds: stringArray(coverage.representedRuleIds, "accuracy.coverage.representedRuleIds"),
    },
    aggregate: {
      counts: counts(aggregate.counts, "accuracy.aggregate.counts"),
      metrics: metrics(aggregate.metrics, "accuracy.aggregate.metrics"),
    },
    rules,
    cases,
    interpretation: boundedString(object.interpretation, "accuracy.interpretation"),
  };
}

function ruleCounts(value: unknown, field: string): Readonly<Record<string, number>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return fail("Benchmark rule counts must be an object.", field);
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > PUBLICATION_EVIDENCE_LIMITS.rules) return fail("Benchmark rule counts exceed the rule budget.", field);
  const result: Record<string, number> = {};
  for (const [key, count] of entries) {
    boundedString(key, `${field}.${key}`);
    result[key] = nonNegativeInteger(count, `${field}.${key}`);
  }
  return result;
}

function benchmarkRun(value: unknown, field: string): PublicationBenchmarkRun {
  const object = exactObject(value, ["run", "filesAnalyzed", "findings", "errors", "findingRuleCounts", "scanDurationMs", "wallMs", "rssDeltaBytes"], field);
  return {
    run: nonNegativeInteger(object.run, `${field}.run`),
    filesAnalyzed: nonNegativeInteger(object.filesAnalyzed, `${field}.filesAnalyzed`),
    findings: nonNegativeInteger(object.findings, `${field}.findings`),
    errors: nonNegativeInteger(object.errors, `${field}.errors`),
    findingRuleCounts: ruleCounts(object.findingRuleCounts, `${field}.findingRuleCounts`),
    scanDurationMs: nonNegativeInteger(object.scanDurationMs, `${field}.scanDurationMs`),
    wallMs: nonNegativeInteger(object.wallMs, `${field}.wallMs`),
    rssDeltaBytes: nonNegativeInteger(object.rssDeltaBytes, `${field}.rssDeltaBytes`),
  };
}

function benchmarkSummary(value: unknown, field: string): PublicationBenchmarkSummary {
  const object = exactObject(value, ["minWallMs", "medianWallMs", "maxWallMs", "medianScanDurationMs", "maxRssDeltaBytes"], field);
  return {
    minWallMs: nonNegativeInteger(object.minWallMs, `${field}.minWallMs`),
    medianWallMs: nonNegativeInteger(object.medianWallMs, `${field}.medianWallMs`),
    maxWallMs: nonNegativeInteger(object.maxWallMs, `${field}.maxWallMs`),
    medianScanDurationMs: nonNegativeInteger(object.medianScanDurationMs, `${field}.medianScanDurationMs`),
    maxRssDeltaBytes: nonNegativeInteger(object.maxRssDeltaBytes, `${field}.maxRssDeltaBytes`),
  };
}

function preflight(value: unknown, field: string): PublicationBenchmarkPreflight {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return fail("Benchmark preflight must be an object.", field);
  const kind = (value as Record<string, unknown>).kind;
  if (kind === "none") {
    exactObject(value, ["kind"], field);
    return { kind: "none" };
  }
  if (kind === "dependency-lockfile") {
    const object = exactObject(value, ["kind", "resolvedComponents", "parserDiagnostics", "osvEnabled"], field);
    if (object.osvEnabled !== false) return fail("Dependency benchmark publication requires OSV disabled.", `${field}.osvEnabled`);
    return {
      kind: "dependency-lockfile",
      resolvedComponents: nonNegativeInteger(object.resolvedComponents, `${field}.resolvedComponents`),
      parserDiagnostics: nonNegativeInteger(object.parserDiagnostics, `${field}.parserDiagnostics`),
      osvEnabled: false,
    };
  }
  return fail("Benchmark preflight kind is unsupported.", `${field}.kind`);
}

function benchmarkProfile(value: unknown, index: number): PublicationBenchmarkProfile {
  const field = `performance.profiles[${index}]`;
  const object = exactObject(value, ["id", "scanner", "expectedFiles", "expectedFindingRuleCounts", "expectedErrors", "maxWallMs", "preflight", "runs", "summary"], field);
  if (object.scanner !== "sca" && object.scanner !== "iac" && object.scanner !== "jsts") return fail("Benchmark scanner is unsupported.", `${field}.scanner`);
  const runs = boundedArray(object.runs, `${field}.runs`, 3).map((item, runIndex) => benchmarkRun(item, `${field}.runs[${runIndex}]`));
  if (runs.length !== 3) return fail("Phase 8B publication requires exactly three runs per profile.", `${field}.runs`);
  return {
    id: boundedString(object.id, `${field}.id`),
    scanner: object.scanner,
    expectedFiles: nonNegativeInteger(object.expectedFiles, `${field}.expectedFiles`),
    expectedFindingRuleCounts: ruleCounts(object.expectedFindingRuleCounts, `${field}.expectedFindingRuleCounts`),
    expectedErrors: nonNegativeInteger(object.expectedErrors, `${field}.expectedErrors`),
    maxWallMs: nonNegativeInteger(object.maxWallMs, `${field}.maxWallMs`),
    preflight: preflight(object.preflight, `${field}.preflight`),
    runs,
    summary: benchmarkSummary(object.summary, `${field}.summary`),
  };
}

function performance(value: unknown): PublicationPerformanceEvidence {
  const object = exactObject(value, ["benchmarkSchemaVersion", "runsPerProfile", "environment", "historical", "profiles"], "performance");
  if (object.benchmarkSchemaVersion !== 1 || object.runsPerProfile !== 3) return fail("Publication benchmark schema or run count is unsupported.", "performance");
  const environment = exactObject(object.environment, ["nodeVersion", "os", "platform", "arch"], "performance.environment");
  const historical = exactObject(object.historical, ["fixture", "filesAnalyzed", "findings", "errors", "scanDurationMs", "wallMs", "rssDeltaBytes", "maxWallMs"], "performance.historical");
  if (historical.fixture !== "scanner-medium-v1") return fail("Historical benchmark identity is invalid.", "performance.historical.fixture");
  const profiles = boundedArray(object.profiles, "performance.profiles", PUBLICATION_EVIDENCE_LIMITS.profiles).map(benchmarkProfile);
  if (new Set(profiles.map((item) => item.id)).size !== profiles.length) return fail("Benchmark profiles contain duplicate identities.", "performance.profiles");
  return {
    benchmarkSchemaVersion: 1,
    runsPerProfile: 3,
    environment: {
      nodeVersion: boundedString(environment.nodeVersion, "performance.environment.nodeVersion"),
      os: boundedString(environment.os, "performance.environment.os"),
      platform: boundedString(environment.platform, "performance.environment.platform"),
      arch: boundedString(environment.arch, "performance.environment.arch"),
    },
    historical: {
      fixture: "scanner-medium-v1",
      filesAnalyzed: nonNegativeInteger(historical.filesAnalyzed, "performance.historical.filesAnalyzed"),
      findings: nonNegativeInteger(historical.findings, "performance.historical.findings"),
      errors: nonNegativeInteger(historical.errors, "performance.historical.errors"),
      scanDurationMs: nonNegativeInteger(historical.scanDurationMs, "performance.historical.scanDurationMs"),
      wallMs: nonNegativeInteger(historical.wallMs, "performance.historical.wallMs"),
      rssDeltaBytes: nonNegativeInteger(historical.rssDeltaBytes, "performance.historical.rssDeltaBytes"),
      maxWallMs: nonNegativeInteger(historical.maxWallMs, "performance.historical.maxWallMs"),
    },
    profiles,
  };
}

function source(value: unknown): PublicationSourceIdentity {
  const object = exactObject(value, ["repository", "phase8aCommit", "phase8bCommit", "phase8bTree", "scopeforgeVersion"], "source");
  const repository = boundedString(object.repository, "source.repository");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) return fail("Publication repository identity is invalid.", "source.repository");
  return {
    repository,
    phase8aCommit: gitIdentity(object.phase8aCommit, "source.phase8aCommit"),
    phase8bCommit: gitIdentity(object.phase8bCommit, "source.phase8bCommit"),
    phase8bTree: gitIdentity(object.phase8bTree, "source.phase8bTree"),
    scopeforgeVersion: boundedString(object.scopeforgeVersion, "source.scopeforgeVersion"),
  };
}

function stringRecord<T extends readonly string[]>(value: unknown, keys: T, field: string): Record<T[number], string> {
  const object = exactObject(value, keys, field);
  const result: Record<string, string> = {};
  for (const key of keys) result[key] = boundedString(object[key], `${field}.${key}`);
  return result as Record<T[number], string>;
}

function reproduction(value: unknown): PublicationReproduction {
  const result = stringRecord(value, ["install", "build", "render", "accuracy", "benchmark"] as const, "reproduction");
  for (const [key, command] of Object.entries(result)) {
    if (/(^|[\s"'=])\/(?!\/)|[A-Za-z]:[\\/]|\\\\|\.\.\\/u.test(command)) {
      return fail("Publication reproduction command contains an absolute or unsafe path.", `reproduction.${key}`);
    }
  }
  return result;
}

function claimBoundaries(value: unknown): PublicationClaimBoundaries {
  return stringRecord(value, [
    "accuracyScope", "unmeasuredScope", "exceptionalOutcomes", "benchmarkScope", "latency", "timing", "memory", "authority",
  ] as const, "claimBoundaries");
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}

export function parsePublicationEvidence(raw: string): PublicationEvidenceV1 {
  if (Buffer.byteLength(raw, "utf8") > PUBLICATION_EVIDENCE_LIMITS.evidenceBytes) {
    return fail("Publication evidence exceeds its fixed byte budget.");
  }
  const duplicateCheck = parseDocument(raw, { schema: "json", uniqueKeys: true });
  if (duplicateCheck.errors.length > 0) return fail("Publication evidence is not strict unique-key JSON.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail("Publication evidence is not valid JSON.");
  }
  const object = exactObject(parsed, ["schemaVersion", "publicationId", "source", "accuracy", "performance", "limitations", "unsupportedScenarios", "claimBoundaries", "reproduction"], "root");
  if (object.schemaVersion !== 1) return fail("Publication evidence schema is unsupported.", "schemaVersion");

  return deepFreeze({
    schemaVersion: 1,
    publicationId: boundedString(object.publicationId, "publicationId"),
    source: source(object.source),
    accuracy: accuracy(object.accuracy),
    performance: performance(object.performance),
    limitations: stringArray(object.limitations, "limitations"),
    unsupportedScenarios: stringArray(object.unsupportedScenarios, "unsupportedScenarios"),
    claimBoundaries: claimBoundaries(object.claimBoundaries),
    reproduction: reproduction(object.reproduction),
  });
}
