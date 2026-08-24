import { SCOPEFORGE_SYNTHETIC_ORIGIN } from "@/packages/runtime-network";
import type { CorsPolicyObservation } from "../contracts";
import type { ActiveRuntimeRuleMatch } from "./types";

function remediation(): ActiveRuntimeRuleMatch["remediation"] {
  return Object.freeze({
    summary: "Restrict cross-origin access to explicitly trusted application origins.",
    actions: Object.freeze([
      Object.freeze({
        title: "Use an explicit CORS allowlist",
        description: "Return Access-Control-Allow-Origin only for origins that are intentionally trusted by the application.",
      }),
      Object.freeze({
        title: "Review credentialed CORS",
        description: "Enable Access-Control-Allow-Credentials only where cross-origin credential use is required and the allowed origins are tightly controlled.",
      }),
    ]),
    verification: Object.freeze({
      summary: "Repeat the bounded origin-policy check and confirm the synthetic untrusted origin is no longer allowed.",
    }),
  });
}

export function evaluateCorsPolicyRules(input: {
  observation: CorsPolicyObservation;
}): readonly ActiveRuntimeRuleMatch[] {
  const observation = input.observation;
  if (observation.allowedOrigin !== SCOPEFORGE_SYNTHETIC_ORIGIN) {
    return Object.freeze([]);
  }

  if (observation.credentialsAllowed) {
    return Object.freeze([
      Object.freeze({
        ruleId: "cors-credentialed-untrusted-origin",
        observationKey: `${observation.url}|credentialed-synthetic-origin`,
        title: "Credentialed CORS policy allows an untrusted origin",
        description: "The observed CORS policy explicitly allowed ScopeForge's synthetic untrusted origin while also allowing credentials. This is a policy weakness observed at runtime; it does not by itself prove that sensitive data was exposed or accessed.",
        severity: "high" as const,
        confidence: "high" as const,
        evidenceSummary: `CORS allowed ${SCOPEFORGE_SYNTHETIC_ORIGIN} with credentials at ${observation.url}.`,
        evidenceKind: "http-observation" as const,
        classification: "public" as const,
        remediation: remediation(),
      }),
    ]);
  }

  return Object.freeze([
    Object.freeze({
      ruleId: "cors-untrusted-origin-allowed",
      observationKey: `${observation.url}|synthetic-origin`,
      title: "CORS policy allows an untrusted origin",
      description: "The observed CORS policy explicitly allowed ScopeForge's synthetic untrusted origin. Credentials were not observed as enabled, so this is reported conservatively as a low-severity policy weakness rather than proven sensitive-data exposure.",
      severity: "low" as const,
      confidence: "high" as const,
      evidenceSummary: `CORS allowed ${SCOPEFORGE_SYNTHETIC_ORIGIN} without credentialed access at ${observation.url}.`,
      evidenceKind: "http-observation" as const,
      classification: "public" as const,
      remediation: remediation(),
    }),
  ]);
}
