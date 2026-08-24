import { createFindingFingerprint } from "../../scanner-core/findings/fingerprint";
import { compareFindings } from "../../scanner-core/findings/severity";
import type { Finding } from "../../scanner-core/findings/types";
import { CONFIG_RULES } from "../rules/config";
import type { IacRuleDefinition } from "../rules/types";
import type { ScanSecurityConfigInput, SecurityConfigKind, SecurityConfigScanResult } from "./types";

const MAX_DIRECT_CONFIG_BYTES = 2 * 1024 * 1024;
const rulesById = new Map(CONFIG_RULES.map((rule) => [rule.id, rule]));

interface FindingDescriptor {
  ruleId: string;
  kind: SecurityConfigKind;
  setting: string;
  structuralContext: string;
  occurrence: number;
  line: number;
  evidenceSummary: string;
}

function ruleEnabled(ruleId: string, input: ScanSecurityConfigInput): boolean {
  const selection = input.rules;
  if (!selection) return true;
  if (selection.exclude.includes(ruleId)) return false;
  return selection.include.length === 0 || selection.include.includes(ruleId);
}

function configKind(file: string): SecurityConfigKind | null {
  const name = file.replace(/\\/g, "/").split("/").at(-1)?.toLowerCase();
  if (name === ".npmrc") return "npmrc";
  if (name === "vercel.json") return "vercel";
  return null;
}

function makeFinding(file: string, descriptor: FindingDescriptor): Finding | null {
  const rule = rulesById.get(descriptor.ruleId) as IacRuleDefinition | undefined;
  if (!rule) return null;

  const fingerprint = createFindingFingerprint({
    scanner: "iac",
    ruleId: rule.id,
    file,
    structuralContext: descriptor.structuralContext,
    source: `occurrence:${descriptor.occurrence}`,
    sink: descriptor.setting
  });

  return {
    id: fingerprint,
    fingerprint,
    scanner: "iac",
    ruleId: rule.id,
    ruleVersion: rule.version,
    title: rule.title,
    description: rule.description,
    severity: rule.severity,
    confidence: rule.confidence,
    category: "iac",
    validation: "static_confirmed",
    provenance: "observed",
    location: {
      file,
      startLine: descriptor.line,
      startColumn: 1,
      endLine: descriptor.line,
      endColumn: 1
    },
    evidence: { summary: descriptor.evidenceSummary },
    cwe: [...rule.cwe],
    owasp: [...rule.owasp],
    references: [],
    remediation: { ...rule.remediation },
    metadata: {
      configKind: descriptor.kind,
      setting: descriptor.setting,
      structuralContext: descriptor.structuralContext
    },
    baselineState: "new"
  };
}

function scanNpmrc(input: ScanSecurityConfigInput): FindingDescriptor[] {
  if (!ruleEnabled("iac/config-npm-strict-ssl-disabled", input)) return [];

  const lines = input.content.replace(/\r\n?/g, "\n").split("\n");
  let effective: { value: string; line: number } | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = (lines[index] ?? "").trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;
    const key = trimmed.slice(0, separator).trim().toLowerCase();
    if (key !== "strict-ssl") continue;
    effective = {
      value: trimmed.slice(separator + 1).trim().toLowerCase(),
      line: index + 1
    };
  }

  if (effective?.value !== "false") return [];
  return [
    {
      ruleId: "iac/config-npm-strict-ssl-disabled",
      kind: "npmrc",
      setting: "strict-ssl",
      structuralContext: "npm configuration strict SSL setting",
      occurrence: 0,
      line: effective.line,
      evidenceSummary: "Observed an effective npm strict-ssl setting explicitly configured to false."
    }
  ];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function vercelHeaderLine(content: string, occurrence: number): number {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  let seen = 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (!/"Access-Control-Allow-Origin"\s*:/i.test(lines[index] ?? "")) continue;
    if (seen === occurrence) return index + 1;
    seen += 1;
  }
  return 1;
}

function scanVercel(input: ScanSecurityConfigInput): SecurityConfigScanResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.content);
  } catch {
    return {
      findings: [],
      errors: [
        {
          code: "invalid_vercel_json",
          file: input.file,
          message: "Vercel configuration contains invalid JSON and was not analyzed."
        }
      ]
    };
  }

  if (!ruleEnabled("iac/config-vercel-wildcard-cors", input)) return { findings: [], errors: [] };
  const root = asRecord(parsed);
  if (!root || !Array.isArray(root.headers)) return { findings: [], errors: [] };

  const descriptors: FindingDescriptor[] = [];
  let matchingHeaderOccurrence = 0;
  for (const rawRoute of root.headers) {
    const route = asRecord(rawRoute);
    if (!route || !Array.isArray(route.headers)) continue;
    for (const rawHeader of route.headers) {
      const header = asRecord(rawHeader);
      if (!header) continue;
      if (typeof header.key !== "string" || typeof header.value !== "string") continue;
      if (header.key.trim().toLowerCase() !== "access-control-allow-origin") continue;
      const occurrence = matchingHeaderOccurrence;
      matchingHeaderOccurrence += 1;
      if (header.value.trim() !== "*") continue;
      descriptors.push({
        ruleId: "iac/config-vercel-wildcard-cors",
        kind: "vercel",
        setting: "Access-Control-Allow-Origin",
        structuralContext: "Vercel response header wildcard CORS setting",
        occurrence,
        line: vercelHeaderLine(input.content, occurrence),
        evidenceSummary: "Observed a Vercel response header that explicitly allows every cross-origin origin."
      });
    }
  }

  return {
    findings: descriptors
      .map((descriptor) => makeFinding(input.file, descriptor))
      .filter((finding): finding is Finding => finding !== null)
      .sort(compareFindings),
    errors: []
  };
}

export function scanSecurityConfig(input: ScanSecurityConfigInput): SecurityConfigScanResult {
  if (Buffer.byteLength(input.content, "utf8") > MAX_DIRECT_CONFIG_BYTES) {
    return {
      findings: [],
      errors: [
        {
          code: "config_file_budget_exceeded",
          file: input.file,
          message: "Supported configuration exceeded the direct analysis size budget."
        }
      ]
    };
  }

  const kind = configKind(input.file);
  if (kind === null) return { findings: [], errors: [] };
  if (kind === "vercel") return scanVercel(input);

  const findings = scanNpmrc(input)
    .map((descriptor) => makeFinding(input.file, descriptor))
    .filter((finding): finding is Finding => finding !== null)
    .sort(compareFindings);
  return { findings, errors: [] };
}
