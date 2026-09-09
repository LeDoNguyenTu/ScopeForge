import { compareText } from "../scanner-core/determinism/compare-text";
import { IAC_RULES } from "../scanner-iac";
import { JSTS_RULES } from "../scanner-jsts";
import { SECRET_RULES } from "../scanner-secrets";
import {
  type LoadedValidationCorpus,
  type ValidationAccuracyResult,
  type ValidationCaseOutcome,
  type ValidationCounts,
  type ValidationDerivedMetrics,
  type ValidationProvenance,
  type ValidationRuleResult,
  type ValidationScannerFamily,
} from "./contracts";
import { ValidationAccuracyError } from "./error";

const INTERPRETATION =
  "Metrics describe only the committed covered corpus and are not global ScopeForge accuracy." as const;

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}

function emptyCounts(): ValidationCounts {
  return {
    tp: 0,
    fn: 0,
    fp: 0,
    tn: 0,
    error: 0,
    unsupported: 0,
    contractMismatch: 0,
  };
}

function addOutcome(counts: ValidationCounts, outcome: ValidationCaseOutcome): void {
  counts[outcome.kind] += 1;
  if (outcome.contractMismatches.length > 0) counts.contractMismatch += 1;
}

export function computeDerivedMetrics(counts: ValidationCounts): ValidationDerivedMetrics {
  const precisionDenominator = counts.tp + counts.fp;
  const recallDenominator = counts.tp + counts.fn;
  const falsePositiveRateDenominator = counts.fp + counts.tn;
  const f1Denominator = (2 * counts.tp) + counts.fp + counts.fn;

  return {
    precision: precisionDenominator === 0 ? null : counts.tp / precisionDenominator,
    recall: recallDenominator === 0 ? null : counts.tp / recallDenominator,
    falsePositiveRate:
      falsePositiveRateDenominator === 0 ? null : counts.fp / falsePositiveRateDenominator,
    f1: f1Denominator === 0 ? null : (2 * counts.tp) / f1Denominator,
  };
}

function ruleVersion(scanner: ValidationScannerFamily, ruleId: string): string {
  const rules = scanner === "secrets"
    ? SECRET_RULES
    : scanner === "jsts"
      ? JSTS_RULES
      : IAC_RULES;
  const rule = rules.find((item) => item.id === ruleId);
  if (!rule) {
    throw new ValidationAccuracyError(
      "VALIDATION_RULE_INVALID",
      "Validation result references a rule that is not registered by its scanner family.",
      "ruleId",
    );
  }
  return rule.version;
}

function validateOutcomeSet(
  corpus: LoadedValidationCorpus,
  outcomes: readonly ValidationCaseOutcome[],
): void {
  if (outcomes.length !== corpus.cases.length) {
    throw new ValidationAccuracyError(
      "VALIDATION_EVALUATION_ERROR",
      "Validation outcome count does not match the loaded corpus.",
    );
  }

  const expected = new Map(corpus.cases.map((item) => [item.manifest.caseId, item.manifest]));
  const seen = new Set<string>();
  for (const outcome of outcomes) {
    if (seen.has(outcome.caseId)) {
      throw new ValidationAccuracyError(
        "VALIDATION_EVALUATION_ERROR",
        "Validation outcomes contain a duplicate case identity.",
      );
    }
    seen.add(outcome.caseId);
    const validationCase = expected.get(outcome.caseId);
    if (
      !validationCase
      || validationCase.scanner !== outcome.scanner
      || validationCase.ruleId !== outcome.ruleId
      || validationCase.label !== outcome.label
    ) {
      throw new ValidationAccuracyError(
        "VALIDATION_EVALUATION_ERROR",
        "Validation outcome identity does not match the loaded corpus.",
      );
    }
  }
}

export function aggregateValidationResult(
  corpus: LoadedValidationCorpus,
  outcomes: readonly ValidationCaseOutcome[],
  provenance: ValidationProvenance,
): ValidationAccuracyResult {
  validateOutcomeSet(corpus, outcomes);
  const orderedOutcomes = [...outcomes].sort((left, right) => compareText(left.caseId, right.caseId));
  const aggregateCounts = emptyCounts();
  const grouped = new Map<string, ValidationCaseOutcome[]>();

  for (const outcome of orderedOutcomes) {
    addOutcome(aggregateCounts, outcome);
    const existing = grouped.get(outcome.ruleId) ?? [];
    existing.push(outcome);
    grouped.set(outcome.ruleId, existing);
  }

  const rules: ValidationRuleResult[] = [...grouped.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([ruleId, ruleOutcomes]) => {
      const counts = emptyCounts();
      for (const item of ruleOutcomes) addOutcome(counts, item);
      const scanner = ruleOutcomes[0]!.scanner;
      return {
        scanner,
        ruleId,
        ruleVersion: ruleVersion(scanner, ruleId),
        caseIds: ruleOutcomes.map((item) => item.caseId).sort(compareText),
        counts,
        metrics: computeDerivedMetrics(counts),
      };
    });

  const representedScannerFamilies = [...new Set(orderedOutcomes.map((item) => item.scanner))]
    .sort(compareText) as ValidationScannerFamily[];
  const representedRuleIds = rules.map((rule) => rule.ruleId);

  return deepFreeze({
    schemaVersion: 1,
    provenance: { ...provenance },
    corpus: {
      id: corpus.manifest.corpusId,
      version: corpus.manifest.corpusVersion,
      contentHash: corpus.contentHash,
    },
    coverage: {
      totalCases: orderedOutcomes.length,
      representedScannerFamilies,
      representedRuleIds,
    },
    aggregate: {
      counts: aggregateCounts,
      metrics: computeDerivedMetrics(aggregateCounts),
    },
    rules,
    cases: orderedOutcomes,
    interpretation: INTERPRETATION,
  });
}
