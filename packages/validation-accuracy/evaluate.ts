import { runScan } from "../scanner-core/coordinator/run-scan";
import { compareText } from "../scanner-core/determinism/compare-text";
import type { Finding, ScanError } from "../scanner-core/findings/types";
import { buildRepositoryInventory } from "../scanner-core/inventory/build-inventory";
import type { RepositoryInventorySummary } from "../scanner-core/inventory/types";
import {
  type LoadedValidationCase,
  type LoadedValidationCorpus,
  type ValidationAccuracyResult,
  type ValidationCaseOutcome,
  type ValidationCaseOutcomeKind,
  type ValidationCaseV1,
  type ValidationContractMismatch,
  type ValidationProvenance,
} from "./contracts";
import { aggregateValidationResult } from "./metrics";
import { createValidationScanner } from "./scanners";

const UNSUPPORTED_DIAGNOSTIC_CODES = new Set([
  "unsupported_binary_source",
  "unsupported_extension",
  "unsupported_binary_dockerfile",
]);

function sortedUnique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort(compareText));
}

function fixedDiagnosticCodes(errors: readonly ScanError[]): readonly string[] {
  return sortedUnique(errors.map((error) => error.code ?? "scanner_error"));
}

function unexpectedRuleIds(
  ruleId: string,
  findings: readonly Finding[],
): readonly string[] {
  return sortedUnique(
    findings
      .filter((finding) => finding.ruleId !== ruleId)
      .map((finding) => finding.ruleId),
  );
}

function compareFinding(left: Finding, right: Finding): number {
  return (
    compareText(left.location.file, right.location.file)
    || left.location.startLine - right.location.startLine
    || left.location.startColumn - right.location.startColumn
    || compareText(left.fingerprint, right.fingerprint)
  );
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  const orderedLeft = [...left].sort(compareText);
  const orderedRight = [...right].sort(compareText);
  return (
    orderedLeft.length === orderedRight.length
    && orderedLeft.every((value, index) => value === orderedRight[index])
  );
}

function contractMismatches(
  validationCase: ValidationCaseV1,
  finding: Finding,
): readonly ValidationContractMismatch[] {
  const mismatches: ValidationContractMismatch[] = [];
  if (
    validationCase.expectedConfidence !== undefined
    && finding.confidence !== validationCase.expectedConfidence
  ) {
    mismatches.push("confidence");
  }
  if (
    validationCase.expectedCwe !== undefined
    && !sameStringSet(finding.cwe, validationCase.expectedCwe)
  ) {
    mismatches.push("cwe");
  }
  if (
    validationCase.expectedSeverity !== undefined
    && finding.severity !== validationCase.expectedSeverity
  ) {
    mismatches.push("severity");
  }
  return Object.freeze(mismatches.sort(compareText));
}

function outcome(
  validationCase: ValidationCaseV1,
  kind: ValidationCaseOutcomeKind,
  options: {
    contractMismatches?: readonly ValidationContractMismatch[];
    unexpectedRuleIds?: readonly string[];
    diagnosticCodes?: readonly string[];
  } = {},
): ValidationCaseOutcome {
  return Object.freeze({
    caseId: validationCase.caseId,
    scanner: validationCase.scanner,
    ruleId: validationCase.ruleId,
    label: validationCase.label,
    kind,
    contractMismatches: Object.freeze([...(options.contractMismatches ?? [])]),
    unexpectedRuleIds: Object.freeze([...(options.unexpectedRuleIds ?? [])]),
    diagnosticCodes: Object.freeze([...(options.diagnosticCodes ?? [])]),
  });
}

export function classifyValidationCase(
  validationCase: ValidationCaseV1,
  findings: readonly Finding[],
  errors: readonly ScanError[],
): ValidationCaseOutcome {
  const unexpected = unexpectedRuleIds(validationCase.ruleId, findings);
  if (errors.length > 0) {
    const diagnosticCodes = fixedDiagnosticCodes(errors);
    const unsupported = diagnosticCodes.every((code) => UNSUPPORTED_DIAGNOSTIC_CODES.has(code));
    return outcome(validationCase, unsupported ? "unsupported" : "error", {
      unexpectedRuleIds: unexpected,
      diagnosticCodes,
    });
  }

  const targetFindings = findings
    .filter((finding) => finding.ruleId === validationCase.ruleId)
    .sort(compareFinding);

  if (validationCase.label === "clean") {
    return outcome(validationCase, targetFindings.length > 0 ? "fp" : "tn", {
      unexpectedRuleIds: unexpected,
    });
  }

  const expectedFiles = new Set(validationCase.expectedFiles);
  const qualifying = targetFindings.filter((finding) => expectedFiles.has(finding.location.file));
  if (qualifying.length === 0) {
    return outcome(validationCase, "fn", { unexpectedRuleIds: unexpected });
  }

  return outcome(validationCase, "tp", {
    contractMismatches: contractMismatches(validationCase, qualifying[0]!),
    unexpectedRuleIds: unexpected,
  });
}

function incompleteInventory(summary: RepositoryInventorySummary): boolean {
  return (
    summary.skippedByReason.file_limit > 0
    || summary.skippedByReason.total_bytes_limit > 0
    || summary.skippedByReason.file_too_large > 0
    || summary.skippedByReason.unreadable > 0
  );
}

export async function evaluateValidationCase(
  validationCase: LoadedValidationCase,
): Promise<ValidationCaseOutcome> {
  let inventory;
  try {
    inventory = await buildRepositoryInventory(validationCase.repositoryDirectory);
  } catch {
    return outcome(validationCase.manifest, "error", {
      diagnosticCodes: ["inventory_error"],
    });
  }

  if (incompleteInventory(inventory.summary)) {
    return outcome(validationCase.manifest, "error", {
      diagnosticCodes: ["inventory_incomplete"],
    });
  }

  const scanner = createValidationScanner(
    validationCase.manifest.scanner,
    validationCase.manifest.ruleId,
  );
  const result = await runScan({
    root: validationCase.repositoryDirectory,
    inventory,
    scanners: [scanner],
  });
  return classifyValidationCase(validationCase.manifest, result.findings, result.errors);
}

export async function evaluateValidationCases(
  corpus: LoadedValidationCorpus,
): Promise<readonly ValidationCaseOutcome[]> {
  const outcomes: ValidationCaseOutcome[] = [];
  for (const validationCase of corpus.cases) {
    outcomes.push(await evaluateValidationCase(validationCase));
  }
  return Object.freeze(outcomes);
}

export async function evaluateValidationCorpus(
  corpus: LoadedValidationCorpus,
  provenance: ValidationProvenance,
): Promise<ValidationAccuracyResult> {
  return aggregateValidationResult(corpus, await evaluateValidationCases(corpus), provenance);
}
