import type { JstsRuleDefinition } from "./types";

export const JSTS_RULES: readonly JstsRuleDefinition[] = [
  {
    id: "jsts/dynamic-code-execution",
    version: "1.0.0",
    title: "Dynamic code execution",
    description: "The source directly uses a JavaScript dynamic-code execution primitive.",
    severity: "medium",
    confidence: "high",
    cwe: ["CWE-95"],
    owasp: ["A03:2021"],
    remediation: {
      summary: "Remove direct dynamic code execution where practical.",
      guidance: "Prefer explicit parsing, dispatch, or allowlisted operations instead of eval or the Function constructor.",
      verification: "Rescan and confirm the dynamic-code execution finding no longer appears."
    }
  },
  {
    id: "jsts/tls-verification-disabled",
    version: "1.0.0",
    title: "TLS certificate verification disabled",
    description: "The source explicitly disables TLS certificate verification in a recognized Node.js configuration shape.",
    severity: "high",
    confidence: "high",
    cwe: ["CWE-295"],
    owasp: ["A02:2021"],
    remediation: {
      summary: "Keep TLS certificate verification enabled.",
      guidance: "Remove the verification-disablement setting and configure trusted certificate authorities explicitly when custom trust is required.",
      verification: "Rescan and confirm the TLS verification finding no longer appears."
    }
  }
] as const;

export const JSTS_RULE_IDS = JSTS_RULES.map((rule) => rule.id);
