import type { IacRuleDefinition } from "./types";

export const CONFIG_RULES: readonly IacRuleDefinition[] = [
  {
    id: "iac/config-npm-strict-ssl-disabled",
    version: "1.0.0",
    title: "npm TLS certificate verification disabled",
    description: "An npm configuration explicitly disables TLS certificate validation for HTTPS registry requests.",
    severity: "medium",
    confidence: "high",
    cwe: ["CWE-295"],
    owasp: ["A02:2021", "A05:2021"],
    remediation: {
      summary: "Keep npm TLS certificate validation enabled.",
      guidance: "Remove the strict-ssl=false setting or set strict-ssl=true. Configure the correct trusted CA or CA file when a private registry or TLS-inspecting proxy requires additional trust configuration.",
      verification: "Rescan and confirm npm configuration no longer explicitly disables strict SSL validation."
    }
  },
  {
    id: "iac/config-vercel-wildcard-cors",
    version: "1.0.0",
    title: "Wildcard CORS header in Vercel configuration",
    description: "A Vercel response-header rule explicitly allows every origin through Access-Control-Allow-Origin: *.",
    severity: "medium",
    confidence: "high",
    cwe: ["CWE-942"],
    owasp: ["A05:2021"],
    remediation: {
      summary: "Restrict cross-origin access to explicitly trusted origins when broad public access is not required.",
      guidance: "Replace the wildcard Access-Control-Allow-Origin value with the smallest reviewed set of origins appropriate for the route. If the resource is intentionally public cross-origin content, document that decision and exclude the rule explicitly.",
      verification: "Rescan and confirm sensitive routes do not emit an unrestricted Access-Control-Allow-Origin header."
    }
  }
] as const;

export const CONFIG_RULE_IDS = CONFIG_RULES.map((rule) => rule.id);
