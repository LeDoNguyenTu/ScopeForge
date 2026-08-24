import type { Finding } from "../findings/types";
import type { ApplyBaselineResult, BaselineFile } from "./types";

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function applyBaseline(
  findings: readonly Finding[],
  baseline: BaselineFile
): ApplyBaselineResult {
  const baselineFingerprints = new Set(baseline.entries.map((entry) => entry.fingerprint));
  const currentFingerprints = new Set(findings.map((finding) => finding.fingerprint));

  return {
    findings: findings.map((finding) => ({
      ...finding,
      baselineState: baselineFingerprints.has(finding.fingerprint) ? "existing" : "new"
    })),
    resolved: baseline.entries
      .filter((entry) => !currentFingerprints.has(entry.fingerprint))
      .slice()
      .sort((left, right) => compareText(left.fingerprint, right.fingerprint))
  };
}
