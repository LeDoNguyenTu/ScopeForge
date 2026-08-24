import type { Finding } from "../findings/types";
import type { ApplyBaselineResult, BaselineFile } from "./types";

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
      .sort((left, right) => left.fingerprint.localeCompare(right.fingerprint))
  };
}
