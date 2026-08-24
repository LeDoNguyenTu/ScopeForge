import type { Finding } from "../findings/types";
import type { BaselineEntry, BaselineFile } from "./types";

export interface SerializeBaselineOptions {
  toolVersion?: string;
}

function entryForFinding(finding: Finding): BaselineEntry {
  return {
    fingerprint: finding.fingerprint,
    scanner: finding.scanner,
    ruleId: finding.ruleId,
    ruleVersion: finding.ruleVersion,
    severity: finding.severity,
    file: finding.location.file
  };
}

function compareEntries(left: BaselineEntry, right: BaselineEntry): number {
  const fields: Array<[string, string]> = [
    [left.fingerprint, right.fingerprint],
    [left.scanner, right.scanner],
    [left.ruleId, right.ruleId],
    [left.ruleVersion, right.ruleVersion],
    [left.severity, right.severity],
    [left.file, right.file]
  ];
  for (const [leftValue, rightValue] of fields) {
    if (leftValue < rightValue) return -1;
    if (leftValue > rightValue) return 1;
  }
  return 0;
}

export function serializeBaseline(
  findings: readonly Finding[],
  options: SerializeBaselineOptions = {}
): string {
  const entries = findings.map(entryForFinding).sort(compareEntries);
  const unique: BaselineEntry[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.fingerprint)) continue;
    seen.add(entry.fingerprint);
    unique.push(entry);
  }

  const baseline: BaselineFile = {
    version: 1,
    tool: {
      name: "ScopeForge",
      version: options.toolVersion ?? "0.1.0"
    },
    entries: unique
  };

  return `${JSON.stringify(baseline, null, 2)}\n`;
}
