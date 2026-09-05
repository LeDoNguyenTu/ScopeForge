import type { ValidationAccuracyResult, ValidationDerivedMetrics } from "./contracts";

function metric(value: number | null): string {
  return value === null ? "n/a" : `${(value * 100).toFixed(2)}%`;
}

function metricCells(metrics: ValidationDerivedMetrics): string[] {
  return [
    metric(metrics.precision),
    metric(metrics.recall),
    metric(metrics.falsePositiveRate),
    metric(metrics.f1),
  ];
}

export function renderValidationAccuracyMarkdown(result: ValidationAccuracyResult): string {
  const lines: string[] = [
    `# ScopeForge Offline Validation Report - ${result.corpus.id}`,
    "",
    "## Scope",
    "",
    `- Corpus: \`${result.corpus.id}@${result.corpus.version}\``,
    `- Cases: ${result.coverage.totalCases}`,
    `- Interpretation: ${result.interpretation}`,
    "",
    "## Provenance",
    "",
    `- ScopeForge version: \`${result.provenance.scopeforgeVersion}\``,
    `- Commit: \`${result.provenance.commitSha}\``,
    `- Corpus content SHA-256: \`${result.corpus.contentHash}\``,
    `- Node.js: \`${result.provenance.nodeVersion}\``,
    `- Platform: \`${result.provenance.platform}\``,
    `- Architecture: \`${result.provenance.arch}\``,
    "",
    "## Coverage",
    "",
    `- Scanner families: ${result.coverage.representedScannerFamilies.map((item) => `\`${item}\``).join(", ") || "none"}`,
    `- Rules: ${result.coverage.representedRuleIds.map((item) => `\`${item}\``).join(", ") || "none"}`,
    "",
    "## Rule Results",
    "",
    "| Rule | Version | Scanner | TP | FN | FP | TN | Error | Unsupported | Contract mismatch | Precision | Recall | FPR | F1 |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const rule of result.rules) {
    lines.push([
      `| \`${rule.ruleId}\``,
      `\`${rule.ruleVersion}\``,
      `\`${rule.scanner}\``,
      String(rule.counts.tp),
      String(rule.counts.fn),
      String(rule.counts.fp),
      String(rule.counts.tn),
      String(rule.counts.error),
      String(rule.counts.unsupported),
      String(rule.counts.contractMismatch),
      ...metricCells(rule.metrics),
    ].join(" | ") + " |");
  }

  lines.push(
    "",
    "### Covered-corpus aggregate",
    "",
    `- TP: ${result.aggregate.counts.tp}`,
    `- FN: ${result.aggregate.counts.fn}`,
    `- FP: ${result.aggregate.counts.fp}`,
    `- TN: ${result.aggregate.counts.tn}`,
    `- Precision: ${metric(result.aggregate.metrics.precision)}`,
    `- Recall: ${metric(result.aggregate.metrics.recall)}`,
    `- False-positive rate: ${metric(result.aggregate.metrics.falsePositiveRate)}`,
    `- F1: ${metric(result.aggregate.metrics.f1)}`,
    "",
    "## Errors/Unsupported",
    "",
    `- Errors: ${result.aggregate.counts.error}`,
    `- Unsupported: ${result.aggregate.counts.unsupported}`,
  );

  const exceptional = result.cases.filter((item) => item.kind === "error" || item.kind === "unsupported");
  if (exceptional.length === 0) {
    lines.push("- No error or unsupported case outcomes.");
  } else {
    for (const item of exceptional) {
      lines.push(`- \`${item.caseId}\`: ${item.kind} (${item.diagnosticCodes.join(", ") || "no diagnostic code"})`);
    }
  }

  lines.push("", "## Contract Mismatches", "");
  const mismatched = result.cases.filter((item) => item.contractMismatches.length > 0);
  if (mismatched.length === 0) {
    lines.push("- None.");
  } else {
    for (const item of mismatched) {
      lines.push(`- \`${item.caseId}\`: ${item.contractMismatches.join(", ")}`);
    }
  }

  lines.push("", "## Unexpected Rules", "");
  const unexpected = result.cases.filter((item) => item.unexpectedRuleIds.length > 0);
  if (unexpected.length === 0) {
    lines.push("- None.");
  } else {
    for (const item of unexpected) {
      lines.push(`- \`${item.caseId}\`: ${item.unexpectedRuleIds.map((ruleId) => `\`${ruleId}\``).join(", ")}`);
    }
  }

  lines.push(
    "",
    "## Limitations",
    "",
    `- ${result.interpretation}`,
    "- Rules and ecosystems absent from this corpus are not measured by this report.",
    "- Error and unsupported outcomes are excluded from precision, recall, FPR, and F1 denominators.",
    "",
  );

  return lines.join("\n");
}
