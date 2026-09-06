import type {
  NormalizedPublicationV1,
  PublicationBenchmarkProfile,
  PublicationMetrics,
} from "./contracts";

function metric(value: number | null): string {
  return value === null ? "n/a" : `${(value * 100).toFixed(2)}%`;
}

function ruleCounts(counts: Readonly<Record<string, number>>): string {
  const entries = Object.entries(counts);
  return entries.length === 0
    ? "none"
    : entries.map(([ruleId, count]) => `\`${ruleId}\` x${count}`).join(", ");
}

function renderProfile(lines: string[], profile: PublicationBenchmarkProfile): void {
  lines.push(
    `### \`${profile.id}\``,
    "",
    `- Scanner: \`${profile.scanner}\``,
    `- Expected analyzed files: ${profile.expectedFiles}`,
    `- Expected findings: ${ruleCounts(profile.expectedFindingRuleCounts)}`,
    `- Expected scanner errors: ${profile.expectedErrors}`,
    `- Catastrophic wall ceiling: ${profile.maxWallMs} ms per run (regression guard, not a product SLO)`,
  );

  if (profile.preflight.kind === "dependency-lockfile") {
    lines.push(
      `- Dependency preflight: ${profile.preflight.resolvedComponents} resolved package-lock components, ${profile.preflight.parserDiagnostics} parser diagnostics, OSV enabled: ${profile.preflight.osvEnabled}`,
    );
  } else {
    lines.push("- Separate profile preflight: none");
  }

  lines.push(
    "",
    "| Run | Files | Findings | Errors | Scanner ms | Wall ms | RSS delta bytes |",
    "| ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  );
  for (const run of profile.runs) {
    lines.push(`| ${run.run} | ${run.filesAnalyzed} | ${run.findings} | ${run.errors} | ${run.scanDurationMs} | ${run.wallMs} | ${run.rssDeltaBytes} |`);
  }
  lines.push(
    "",
    `- Wall min / median / max: ${profile.summary.minWallMs} / ${profile.summary.medianWallMs} / ${profile.summary.maxWallMs} ms`,
    `- Median scanner duration: ${profile.summary.medianScanDurationMs} ms`,
    `- Maximum observed RSS delta: ${profile.summary.maxRssDeltaBytes} bytes`,
    "",
  );
}

function aggregateMetricLines(metrics: PublicationMetrics): string[] {
  return [
    `- Precision: ${metric(metrics.precision)}`,
    `- Recall: ${metric(metrics.recall)}`,
    `- False-positive rate: ${metric(metrics.falsePositiveRate)}`,
    `- F1: ${metric(metrics.f1)}`,
  ];
}

export function renderTechnicalPublicationMarkdown(result: NormalizedPublicationV1): string {
  const lines: string[] = [
    `# ScopeForge Phase 8 Technical Publication - ${result.publicationId}`,
    "",
    "## Scope and Claim Boundaries",
    "",
    `- ${result.claimBoundaries.accuracyScope}`,
    `- ${result.claimBoundaries.unmeasuredScope}`,
    `- ${result.claimBoundaries.exceptionalOutcomes}`,
    `- ${result.claimBoundaries.benchmarkScope}`,
    `- ${result.claimBoundaries.latency}`,
    `- ${result.claimBoundaries.timing}`,
    `- ${result.claimBoundaries.memory}`,
    `- ${result.claimBoundaries.authority}`,
    "",
    "## Provenance",
    "",
    `- Repository: \`${result.source.repository}\``,
    `- ScopeForge version: \`${result.source.scopeforgeVersion}\``,
    `- Phase 8A evidence commit: \`${result.source.phase8aCommit}\``,
    `- Phase 8B executable commit: \`${result.source.phase8bCommit}\``,
    `- Phase 8B executable tree: \`${result.source.phase8bTree}\``,
    "",
    "## Accuracy Evidence",
    "",
    `- Corpus: \`${result.accuracy.corpus.id}@${result.accuracy.corpus.version}\``,
    `- Corpus content SHA-256: \`${result.accuracy.corpus.contentHash}\``,
    `- Reviewed cases: ${result.accuracy.coverage.totalCases}`,
    `- Scanner families: ${result.accuracy.coverage.representedScannerFamilies.map((item) => `\`${item}\``).join(", ") || "none"}`,
    `- Represented rules: ${result.accuracy.coverage.representedRuleIds.map((item) => `\`${item}\``).join(", ") || "none"}`,
    `- Interpretation: ${result.accuracy.interpretation}`,
    "",
    "### Covered-corpus confusion matrix",
    "",
    `- TP: ${result.accuracy.aggregate.counts.tp}`,
    `- FN: ${result.accuracy.aggregate.counts.fn}`,
    `- FP: ${result.accuracy.aggregate.counts.fp}`,
    `- TN: ${result.accuracy.aggregate.counts.tn}`,
    `- Errors: ${result.accuracy.aggregate.counts.error}`,
    `- Unsupported: ${result.accuracy.aggregate.counts.unsupported}`,
    `- Contract mismatches: ${result.accuracy.aggregate.counts.contractMismatch}`,
    ...aggregateMetricLines(result.accuracy.aggregate.metrics),
    "",
    "## Rule Results",
    "",
    "| Rule | Version | Scanner | TP | FN | FP | TN | Error | Unsupported | Contract mismatch | Precision | Recall | FPR | F1 |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const rule of result.accuracy.rules) {
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
      metric(rule.metrics.precision),
      metric(rule.metrics.recall),
      metric(rule.metrics.falsePositiveRate),
      metric(rule.metrics.f1),
    ].join(" | ") + " |");
  }

  lines.push("", "## Exceptional Accuracy Outcomes", "");
  const exceptional = result.accuracy.cases.filter((item) => (
    item.kind === "error"
    || item.kind === "unsupported"
    || item.contractMismatches.length > 0
    || item.unexpectedRuleIds.length > 0
  ));
  if (exceptional.length === 0) {
    lines.push("- None.");
  } else {
    for (const item of exceptional) {
      const details: string[] = [`outcome=${item.kind}`];
      if (item.diagnosticCodes.length > 0) details.push(`diagnostics=${item.diagnosticCodes.join(",")}`);
      if (item.contractMismatches.length > 0) details.push(`contract-mismatches=${item.contractMismatches.join(",")}`);
      if (item.unexpectedRuleIds.length > 0) details.push(`unexpected-rules=${item.unexpectedRuleIds.join(",")}`);
      lines.push(`- \`${item.caseId}\`: ${details.join("; ")}`);
    }
  }

  lines.push(
    "",
    "## Performance Environment",
    "",
    `- Node.js: \`${result.performance.environment.nodeVersion}\``,
    `- OS: \`${result.performance.environment.os}\``,
    `- Platform: \`${result.performance.environment.platform}\``,
    `- Architecture: \`${result.performance.environment.arch}\``,
    `- Repeated runs per matrix profile: ${result.performance.runsPerProfile}`,
    `- ${result.claimBoundaries.timing}`,
    `- ${result.claimBoundaries.memory}`,
    "",
    "## Historical Benchmark Continuity",
    "",
    `- Fixture: \`${result.performance.historical.fixture}\``,
    `- Files analyzed: ${result.performance.historical.filesAnalyzed}`,
    `- Findings: ${result.performance.historical.findings}`,
    `- Errors: ${result.performance.historical.errors}`,
    `- Scanner duration: ${result.performance.historical.scanDurationMs} ms`,
    `- Wall time: ${result.performance.historical.wallMs} ms`,
    `- RSS delta: ${result.performance.historical.rssDeltaBytes} bytes (observational only)`,
    `- Catastrophic wall ceiling: ${result.performance.historical.maxWallMs} ms (regression guard, not a product SLO)`,
    "",
    "## Performance Matrix",
    "",
  );

  for (const profile of result.performance.profiles) renderProfile(lines, profile);

  lines.push("## Limitations", "");
  if (result.limitations.length === 0) {
    lines.push("- None recorded.");
  } else {
    for (const limitation of result.limitations) lines.push(`- ${limitation}`);
  }

  lines.push("", "## Unsupported Scenarios", "");
  if (result.unsupportedScenarios.length === 0) {
    lines.push("- None recorded.");
  } else {
    for (const scenario of result.unsupportedScenarios) lines.push(`- ${scenario}`);
  }

  lines.push(
    "",
    "## Reproduction",
    "",
    "Publication rendering consumes committed evidence. It does not silently rerun environment-sensitive measurements.",
    "",
    "```bash",
    result.reproduction.install,
    result.reproduction.build,
    result.reproduction.render,
    "```",
    "",
    "Original evidence commands:",
    "",
    "```bash",
    result.reproduction.accuracy,
    result.reproduction.benchmark,
    "```",
    "",
    "## Authority Boundary",
    "",
    `- ${result.claimBoundaries.authority}`,
    "- Report generation is local/offline and does not require Supabase, hosted scanning, repository acquisition, browser authority, runtime workers, or arbitrary network access.",
    "",
  );

  return lines.join("\n");
}
