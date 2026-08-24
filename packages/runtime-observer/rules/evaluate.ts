import type { RuntimeObservation } from "../observations";
import type { RuntimeRuleMatch } from "./types";

const MAX_EVIDENCE_SUMMARY_LENGTH = 4_096;

function boundSummary(value: string): string {
  return value.length <= MAX_EVIDENCE_SUMMARY_LENGTH
    ? value
    : value.slice(0, MAX_EVIDENCE_SUMMARY_LENGTH);
}

function remediation(summary: string, action: string, verification: string) {
  return {
    summary,
    actions: [{ title: "Recommended hardening", description: action }],
    verification: { summary: verification },
  } as const;
}

function headerMatches(
  observation: RuntimeObservation,
  name: string,
): observation is Extract<RuntimeObservation, { kind: "header" }> {
  return observation.kind === "header" && observation.name.toLowerCase() === name;
}

function makeMatch(input: RuntimeRuleMatch): RuntimeRuleMatch {
  return Object.freeze({
    ...input,
    evidenceSummary: boundSummary(input.evidenceSummary),
  });
}

function isSessionLikeCookie(name: string): boolean {
  return /(^|[_-])(session|sess|sid|auth|token)([_-]|$)/i.test(name)
    || /session/i.test(name);
}

export function evaluateRuntimeRules(input: {
  observations: readonly RuntimeObservation[];
  now?: Date;
}): readonly RuntimeRuleMatch[] {
  const now = input.now ?? new Date();
  const matches = new Map<string, RuntimeRuleMatch>();

  const add = (match: RuntimeRuleMatch) => {
    const key = `${match.ruleId}\u0000${match.observationKey}`;
    if (!matches.has(key)) matches.set(key, makeMatch(match));
  };

  for (const observation of input.observations) {
    if (headerMatches(observation, "strict-transport-security")) {
      if (!observation.present) {
        add({
          ruleId: "runtime/http/missing-hsts",
          observationKey: "header:strict-transport-security",
          title: "HTTP Strict Transport Security is not advertised",
          description: "The observed HTTPS response did not advertise an HSTS policy. This is a transport-hardening configuration observation.",
          severity: "low",
          confidence: "high",
          evidenceSummary: "The observed response did not include the Strict-Transport-Security header.",
          evidenceKind: "http-observation",
          classification: "public",
          remediation: remediation(
            "Advertise an HSTS policy on HTTPS responses where it is appropriate for the application.",
            "Add a Strict-Transport-Security header with a deliberate max-age and review whether includeSubDomains is suitable for the domain.",
            "Repeat the passive observation and confirm the expected Strict-Transport-Security header is present.",
          ),
        });
      } else if (!observation.value?.toLowerCase().includes("includesubdomains")) {
        add({
          ruleId: "runtime/http/hsts-without-include-subdomains",
          observationKey: "header:strict-transport-security",
          title: "HSTS does not include subdomains",
          description: "The observed HSTS policy does not include the includeSubDomains directive. This may be intentional and should be reviewed against the deployment model.",
          severity: "info",
          confidence: "high",
          evidenceSummary: `Observed Strict-Transport-Security: ${observation.value ?? "<empty>"}`,
          evidenceKind: "http-observation",
          classification: "public",
          remediation: remediation(
            "Review whether HSTS should cover subdomains.",
            "If every relevant subdomain is HTTPS-only, consider adding includeSubDomains after validating operational impact.",
            "Repeat the passive observation and confirm the deployed HSTS policy matches the intended scope.",
          ),
        });
      }
    }

    if (headerMatches(observation, "x-content-type-options")) {
      const value = observation.value?.trim().toLowerCase();
      if (!observation.present || value !== "nosniff") {
        add({
          ruleId: "runtime/http/missing-nosniff",
          observationKey: "header:x-content-type-options",
          title: "X-Content-Type-Options nosniff is not enforced",
          description: "The observed response did not provide the expected X-Content-Type-Options: nosniff policy.",
          severity: "low",
          confidence: "high",
          evidenceSummary: observation.present
            ? `Observed X-Content-Type-Options: ${observation.value ?? "<empty>"}`
            : "The observed response did not include X-Content-Type-Options.",
          evidenceKind: "http-observation",
          classification: "public",
          remediation: remediation(
            "Set a consistent nosniff response policy.",
            "Return X-Content-Type-Options: nosniff on relevant application responses.",
            "Repeat the passive observation and confirm the header value is nosniff.",
          ),
        });
      }
    }

    if (observation.kind === "cookie") {
      if (!observation.secure) {
        add({
          ruleId: "runtime/cookie/missing-secure",
          observationKey: `cookie:${observation.name.toLowerCase()}`,
          title: "HTTPS cookie is missing the Secure attribute",
          description: `The observed cookie ${observation.name || "<unnamed>"} was set without the Secure attribute on an HTTPS response.`,
          severity: "medium",
          confidence: "high",
          evidenceSummary: `Cookie ${observation.name || "<unnamed>"} was observed without Secure. Cookie values were not retained.`,
          evidenceKind: "http-observation",
          classification: "public",
          remediation: remediation(
            "Protect HTTPS cookies with the Secure attribute.",
            "Set Secure on cookies that should only be sent over HTTPS and validate application compatibility.",
            "Repeat the passive observation and confirm the cookie is emitted with Secure.",
          ),
        });
      }

      if (isSessionLikeCookie(observation.name) && !observation.httpOnly) {
        add({
          ruleId: "runtime/cookie/session-missing-httponly",
          observationKey: `cookie:${observation.name.toLowerCase()}`,
          title: "Session-like cookie is missing HttpOnly",
          description: `The observed session-like cookie ${observation.name || "<unnamed>"} was set without the HttpOnly attribute.`,
          severity: "medium",
          confidence: "medium",
          evidenceSummary: `Session-like cookie ${observation.name || "<unnamed>"} was observed without HttpOnly. Cookie values were not retained.`,
          evidenceKind: "http-observation",
          classification: "public",
          remediation: remediation(
            "Use HttpOnly for session cookies that do not require script access.",
            "Set HttpOnly after confirming client-side code does not need to read the session cookie.",
            "Repeat the passive observation and confirm the session cookie is emitted with HttpOnly.",
          ),
        });
      }
    }

    if (observation.kind === "tls" && observation.validTo) {
      const expiresAt = Date.parse(observation.validTo);
      if (Number.isFinite(expiresAt) && expiresAt <= now.getTime()) {
        add({
          ruleId: "runtime/tls/certificate-expired",
          observationKey: "tls:certificate-validity",
          title: "TLS certificate is expired",
          description: "The certificate validity metadata observed during the TLS connection indicates that the certificate has expired.",
          severity: "high",
          confidence: "high",
          evidenceSummary: `Observed certificate validity ended at ${observation.validTo}.`,
          evidenceKind: "tls-observation",
          classification: "public",
          remediation: remediation(
            "Replace the expired TLS certificate and verify the served chain.",
            "Renew or replace the certificate, deploy the intended chain, and confirm the endpoint serves the updated certificate.",
            "Repeat the passive TLS observation and confirm the certificate validity window is current.",
          ),
        });
      }
    }
  }

  return Object.freeze(
    [...matches.values()].sort((left, right) =>
      left.ruleId.localeCompare(right.ruleId)
      || left.observationKey.localeCompare(right.observationKey)),
  );
}
