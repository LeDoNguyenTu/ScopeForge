export const SCA_RULES = [
  {
    id: "sca/known-vulnerability",
    version: "1.0.0",
    title: "Known vulnerable dependency"
  }
] as const;

export const SCA_RULE_IDS = SCA_RULES.map((rule) => rule.id);

export { createVulnerabilityFinding } from "./findings/create-vulnerability-finding";
export { collectNpmDependencies } from "./inventory";
export { createScaScanner } from "./scanner";
export { queryOsvDependencies } from "./osv/client";
export type { OsvClientOptions, OsvLookupResult, OsvVulnerabilityRecord } from "./osv/types";
export type { NpmDependencyComponent, DependencyInventoryResult } from "./types";
