import { JSTS_RULES } from "@/packages/scanner-jsts/rules/builtin";
import { SECRET_RULES } from "@/packages/scanner-secrets/rules/builtin";
import { IAC_RULES as BASE_IAC_RULES } from "@/packages/scanner-iac/rules/builtin";
import { TERRAFORM_RULES } from "@/packages/scanner-iac/rules/terraform";
import { GITHUB_ACTIONS_RULES } from "@/packages/scanner-iac/rules/github-actions";
import { CONFIG_RULES } from "@/packages/scanner-iac/rules/config";

export type Phase3ImportValidationErrorCode =
  | "PHASE3_IMPORT_INVALID"
  | "PHASE3_SOURCE_NOT_ALLOWED"
  | "PHASE3_RUN_REF_CONFLICT";

export class Phase3ImportValidationError extends Error {
  readonly code: Phase3ImportValidationErrorCode;

  constructor(code: Phase3ImportValidationErrorCode, message: string = code) {
    super(message);
    this.name = "Phase3ImportValidationError";
    this.code = code;
  }
}

export interface Phase3SourceDescriptor {
  sourceKind: "deterministic-passive-scanner";
  sourceId: string;
  sourceVersion: string;
  ruleRef: string;
  provenanceKind: "scanner-derived";
  evidenceKind: "static-analysis" | "dependency";
  classification: "internal";
  artifactRef: null;
}

export const PHASE3_ALLOWED_SCANNER_DESCRIPTORS = Object.freeze([
  "iac@1.0.0",
  "jsts@1.0.0",
  "sca@1.0.0",
  "secrets@1.0.0",
] as const);

const allowedScannerDescriptors = new Set<string>(PHASE3_ALLOWED_SCANNER_DESCRIPTORS);

interface RegisteredRule {
  scanner: "iac" | "jsts" | "sca" | "secrets";
  ruleId: string;
  ruleVersion: string;
  evidenceKind: "static-analysis" | "dependency";
}

function registeredRules(): RegisteredRule[] {
  const iacRules = [
    ...BASE_IAC_RULES,
    ...TERRAFORM_RULES,
    ...GITHUB_ACTIONS_RULES,
    ...CONFIG_RULES,
  ].map((rule) => ({
    scanner: "iac" as const,
    ruleId: rule.id,
    ruleVersion: rule.version,
    evidenceKind: "static-analysis" as const,
  }));

  return [
    ...JSTS_RULES.map((rule) => ({
      scanner: "jsts" as const,
      ruleId: rule.id,
      ruleVersion: rule.version,
      evidenceKind: "static-analysis" as const,
    })),
    ...SECRET_RULES.map((rule) => ({
      scanner: "secrets" as const,
      ruleId: rule.id,
      ruleVersion: rule.version,
      evidenceKind: "static-analysis" as const,
    })),
    ...iacRules,
    {
      scanner: "sca" as const,
      ruleId: "sca/known-vulnerability",
      ruleVersion: "1.0.0",
      evidenceKind: "dependency" as const,
    },
  ];
}

const ruleRegistry = new Map(
  registeredRules().map((entry) => [
    `${entry.scanner}\u0000${entry.ruleId}\u0000${entry.ruleVersion}`,
    entry,
  ]),
);

export function isAllowedPhase3ScannerDescriptor(value: string): boolean {
  return allowedScannerDescriptors.has(value);
}

export function resolvePhase3Source(
  scanner: string,
  ruleId: string,
  ruleVersion: string,
): Phase3SourceDescriptor {
  const entry = ruleRegistry.get(`${scanner}\u0000${ruleId}\u0000${ruleVersion}`);
  if (!entry) {
    throw new Phase3ImportValidationError(
      "PHASE3_SOURCE_NOT_ALLOWED",
      "The uploaded finding does not match a reviewed ScopeForge Phase 3 source.",
    );
  }

  return Object.freeze({
    sourceKind: "deterministic-passive-scanner",
    sourceId: `scopeforge:${entry.scanner}:${entry.ruleId}`,
    sourceVersion: entry.ruleVersion,
    ruleRef: `phase3-rule:${entry.ruleId}@${entry.ruleVersion}`,
    provenanceKind: "scanner-derived",
    evidenceKind: entry.evidenceKind,
    classification: "internal",
    artifactRef: null,
  });
}