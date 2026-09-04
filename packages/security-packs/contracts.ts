import type {
  Confidence,
  FindingRemediation,
  Severity,
} from "../scanner-core/findings/types";

export const SECURITY_PACK_LIMITS = Object.freeze({
  manifestBytes: 256 * 1024,
  rulesPerPack: 100,
  selectedPacks: 10,
  selectedRules: 500,
  includePatternsPerRule: 16,
  excludePatternsPerRule: 16,
  literalsPerRule: 16,
  literalBytes: 256,
  fixtureCasesPerRule: 20,
  fixtureFilesPerCase: 100,
  fixtureBytesPerCase: 1024 * 1024,
  findingsPerPack: 1000,
  guidanceFieldBytes: 8 * 1024,
});

export type SecurityPackLicense =
  | "Apache-2.0"
  | "BSD-3-Clause"
  | "CC-BY-4.0"
  | "MIT";

export interface StaticLiteralMatcherV1 {
  include: readonly string[];
  exclude: readonly string[];
  mode: "any" | "all";
  literals: readonly string[];
  absentLiterals: readonly string[];
  caseSensitive: boolean;
}

export interface SecurityPackRuleV1 {
  id: string;
  version: string;
  kind: "static_literal_v1";
  title: string;
  summary: string;
  description: string;
  severity: Severity;
  confidence: Confidence;
  category: string;
  mappings: {
    cwe: readonly string[];
    owasp: readonly string[];
    attack: readonly string[];
    nistCsf: readonly string[];
  };
  explanations: {
    plain: string;
    developer: string;
    security: string;
  };
  remediation: FindingRemediation;
  preparedness: readonly string[];
  falsePositiveNotes: readonly string[];
  matcher: StaticLiteralMatcherV1;
}

export interface SecurityPackManifestV1 {
  schemaVersion: 1;
  packId: string;
  version: string;
  name: string;
  summary: string;
  license: SecurityPackLicense;
  repository: string;
  maintainers: readonly string[];
  safety: "static";
  minimumScopeForgeVersion: string;
  rules: readonly SecurityPackRuleV1[];
}

export interface LoadedSecurityPack {
  packDirectory: string;
  manifestPath: string;
  manifest: SecurityPackManifestV1;
}
