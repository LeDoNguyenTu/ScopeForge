import { compareText } from "../determinism/compare-text";
import type { Finding, Severity } from "./types";

export const severityRank = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
} as const satisfies Record<Severity, number>;

export function compareSeverity(left: Severity, right: Severity): number {
  return severityRank[left] - severityRank[right];
}

export function isSeverityAtLeast(actual: Severity, threshold: Severity): boolean {
  return compareSeverity(actual, threshold) >= 0;
}

export function compareFindings(left: Finding, right: Finding): number {
  const severityDifference = severityRank[right.severity] - severityRank[left.severity];
  if (severityDifference !== 0) return severityDifference;

  const fileDifference = compareText(left.location.file, right.location.file);
  if (fileDifference !== 0) return fileDifference;

  const lineDifference = left.location.startLine - right.location.startLine;
  if (lineDifference !== 0) return lineDifference;

  const ruleDifference = compareText(left.ruleId, right.ruleId);
  if (ruleDifference !== 0) return ruleDifference;

  return compareText(left.fingerprint, right.fingerprint);
}
