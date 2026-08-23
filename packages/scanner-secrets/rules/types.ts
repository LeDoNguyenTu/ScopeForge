import type { Confidence, Severity } from "../../scanner-core/findings/types";

export type SecretProvider = "github" | "stripe" | "slack" | "private-key" | "entropy";

export interface SecretRuleDefinition {
  id: string;
  version: string;
  title: string;
  description: string;
  severity: Severity;
  confidence: Confidence;
  provider: SecretProvider;
  pattern?: RegExp;
  publicPrefix?: string;
}

export interface SecretRuleSelection {
  include?: string[];
  exclude?: string[];
}
