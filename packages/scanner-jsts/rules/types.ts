import type { Confidence, FindingRemediation, Severity } from "../../scanner-core/findings/types";

export interface JstsRuleDefinition {
  id: string;
  version: string;
  title: string;
  description: string;
  severity: Severity;
  confidence: Confidence;
  cwe: string[];
  owasp: string[];
  remediation: FindingRemediation;
}
