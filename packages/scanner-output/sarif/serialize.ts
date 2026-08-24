import { compareFindings, severityRank } from "../../scanner-core/findings/severity";
import type { BaselineState, Finding, ScanResult, Severity } from "../../scanner-core/findings/types";

export interface SerializeSarifOptions {
  toolVersion?: string;
}

type SarifLevel = "error" | "warning" | "note";
type SarifBaselineState = "new" | "unchanged";

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sarifLevel(severity: Severity): SarifLevel {
  if (severity === "critical" || severity === "high") return "error";
  if (severity === "medium") return "warning";
  return "note";
}

function sarifBaselineState(state: BaselineState): SarifBaselineState | undefined {
  if (state === "new") return "new";
  if (state === "existing") return "unchanged";
  return undefined;
}

function highestSeverity(findings: readonly Finding[]): Severity {
  let highest: Severity = "info";
  for (const finding of findings) {
    if (severityRank[finding.severity] > severityRank[highest]) highest = finding.severity;
  }
  return highest;
}

function compareRuleRepresentative(left: Finding, right: Finding): number {
  const fields: Array<[string, string]> = [
    [left.ruleVersion, right.ruleVersion],
    [left.title, right.title],
    [left.description, right.description],
    [left.remediation.summary, right.remediation.summary],
    [left.remediation.guidance, right.remediation.guidance],
    [left.remediation.verification, right.remediation.verification],
    [left.fingerprint, right.fingerprint]
  ];
  for (const [leftValue, rightValue] of fields) {
    const difference = compareText(leftValue, rightValue);
    if (difference !== 0) return difference;
  }
  return 0;
}

function ruleTags(findings: readonly Finding[]): string[] {
  const cwe = new Set<string>();
  const owasp = new Set<string>();
  for (const finding of findings) {
    for (const tag of finding.cwe) cwe.add(tag);
    for (const tag of finding.owasp) owasp.add(tag);
  }
  return [
    "security",
    ...[...cwe].sort(compareText),
    ...[...owasp].sort(compareText)
  ];
}

function ruleHelp(finding: Finding): string {
  return [
    finding.remediation.summary,
    finding.remediation.guidance,
    `Verification: ${finding.remediation.verification}`
  ].join("\n\n");
}

function safeArtifactUri(file: string): string | null {
  if (!file || file.includes("\0") || file.includes("\\")) return null;
  if (file.startsWith("/") || /^[A-Za-z]:[\\/]/.test(file)) return null;

  const segments = file.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return null;
  }

  return segments.map((segment) => encodeURIComponent(segment)).join("/");
}

function positiveInteger(value: number): number | undefined {
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function physicalLocation(finding: Finding): Record<string, unknown> | null {
  const uri = safeArtifactUri(finding.location.file);
  if (uri === null) return null;

  const startLine = positiveInteger(finding.location.startLine);
  const startColumn = positiveInteger(finding.location.startColumn);
  const endLine = positiveInteger(finding.location.endLine);
  const endColumn = positiveInteger(finding.location.endColumn);

  const region = startLine === undefined
    ? undefined
    : {
        startLine,
        ...(startColumn !== undefined ? { startColumn } : {}),
        ...(endLine !== undefined ? { endLine } : {}),
        ...(endColumn !== undefined ? { endColumn } : {})
      };

  return {
    artifactLocation: {
      uri,
      uriBaseId: "%SRCROOT%"
    },
    ...(region !== undefined ? { region } : {})
  };
}

function fixedResultProperties(finding: Finding): Record<string, string> {
  return {
    "scopeforge/severity": finding.severity,
    "scopeforge/confidence": finding.confidence,
    "scopeforge/validation": finding.validation,
    "scopeforge/provenance": finding.provenance,
    "scopeforge/baselineState": finding.baselineState
  };
}

function buildRuleTable(findings: readonly Finding[]) {
  const groups = new Map<string, Finding[]>();
  for (const finding of findings) {
    const existing = groups.get(finding.ruleId);
    if (existing) existing.push(finding);
    else groups.set(finding.ruleId, [finding]);
  }

  const ruleIds = [...groups.keys()].sort(compareText);
  const ruleIndex = new Map<string, number>();
  const rules = ruleIds.map((ruleId, index) => {
    ruleIndex.set(ruleId, index);
    const group = [...(groups.get(ruleId) ?? [])].sort(compareRuleRepresentative);
    const representative = group[0];
    if (!representative) throw new Error(`Missing SARIF rule representative for ${ruleId}.`);
    const severity = highestSeverity(group);

    return {
      id: ruleId,
      name: ruleId,
      shortDescription: { text: representative.title },
      fullDescription: { text: representative.description },
      help: { text: ruleHelp(representative) },
      defaultConfiguration: { level: sarifLevel(severity) },
      properties: {
        tags: ruleTags(group),
        "scopeforge/severity": severity
      }
    };
  });

  return { rules, ruleIndex };
}

export function serializeSarifResult(
  result: ScanResult,
  options: SerializeSarifOptions = {}
): string {
  const orderedFindings = [...result.findings].sort(compareFindings);
  const { rules, ruleIndex } = buildRuleTable(orderedFindings);

  const results = orderedFindings.map((finding) => {
    const location = physicalLocation(finding);
    const baselineState = sarifBaselineState(finding.baselineState);
    const index = ruleIndex.get(finding.ruleId);
    if (index === undefined) throw new Error(`Missing SARIF rule index for ${finding.ruleId}.`);

    return {
      ruleId: finding.ruleId,
      ruleIndex: index,
      level: sarifLevel(finding.severity),
      message: {
        text: `${finding.title}: ${finding.evidence.summary}`
      },
      ...(location !== null ? { locations: [{ physicalLocation: location }] } : {}),
      partialFingerprints: {
        "scopeforge/v1": finding.fingerprint
      },
      ...(baselineState !== undefined ? { baselineState } : {}),
      properties: fixedResultProperties(finding)
    };
  });

  const sarif = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "ScopeForge",
            version: options.toolVersion ?? "0.1.0",
            informationUri: "https://github.com/LeDoNguyenTu/ScopeForge",
            rules
          }
        },
        originalUriBaseIds: {
          "%SRCROOT%": { uri: "./" }
        },
        results
      }
    ]
  };

  return `${JSON.stringify(sarif, null, 2)}\n`;
}
