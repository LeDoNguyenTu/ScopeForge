import type { ScanResult, Severity } from "../scanner-core/findings/types";

const severityOrder: Severity[] = ["critical", "high", "medium", "low", "info"];

export function formatTerminalResult(result: ScanResult): string {
  const lines = [
    "ScopeForge scan",
    "",
    `Repository  ${result.scan.root}`,
    `Files       ${result.inventory.filesAnalyzed} analyzed, ${result.inventory.filesSkipped} skipped`,
    `Duration    ${result.scan.durationMs}ms`,
    ""
  ];

  if (result.findings.length === 0) {
    lines.push("No findings.", "");
  } else {
    for (const finding of result.findings) {
      lines.push(
        `${finding.severity.toUpperCase().padEnd(8)}${finding.title}  ${finding.location.file}:${finding.location.startLine}`
      );
    }
    lines.push("");
  }

  const counts = severityOrder
    .map((severity) => ({ severity, count: result.findings.filter((finding) => finding.severity === severity).length }))
    .filter((item) => item.count > 0)
    .map((item) => `${item.count} ${item.severity}`);

  lines.push(`${result.findings.length} findings${counts.length ? `: ${counts.join(", ")}` : ""}`);
  lines.push(
    result.policy.mode === "report-only"
      ? "Policy: report-only"
      : `Policy: ${result.policy.passed ? "passed" : "failed"} (fail-on ${result.policy.failOn})`
  );

  if (result.errors.length > 0) {
    lines.push(`Scanner errors: ${result.errors.length}`);
  }

  return `${lines.join("\n")}\n`;
}
