import {
  ACTIVE_RUNTIME_USER_AGENT,
  SCOPEFORGE_SYNTHETIC_ORIGIN,
  type TrustedRuntimeRequestPlan,
} from "@/packages/runtime-network";
import type {
  ActiveValidationBudget,
  AuthorizedValidationTarget,
} from "./contracts";

export function validateCorsOriginPolicyTarget(
  target: AuthorizedValidationTarget,
): URL {
  if (target.kind !== "web_application" && target.kind !== "api") {
    throw new Error("CORS validation supports verified web and API assets only.");
  }

  let url: URL;
  try {
    url = new URL(target.canonicalUrl);
  } catch {
    throw new Error("CORS validation requires a valid canonical URL.");
  }

  if (url.protocol !== "https:") {
    throw new Error("CORS validation requires HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("CORS validation does not allow URL credentials.");
  }
  const port = url.port ? Number(url.port) : 443;
  if (port !== 443) {
    throw new Error("CORS validation supports HTTPS port 443 only.");
  }
  if (url.hostname.toLowerCase() !== target.hostname.trim().toLowerCase()) {
    throw new Error("CORS validation hostname must match the authorized target.");
  }
  if (url.search) {
    throw new Error("CORS validation canonical targets must not contain a query string.");
  }
  if (url.hash) {
    throw new Error("CORS validation canonical targets must not contain a fragment.");
  }

  return url;
}

export function buildCorsOriginPolicyRequestPlan(input: {
  target: AuthorizedValidationTarget;
  budget: Readonly<ActiveValidationBudget>;
  timeoutMs?: number;
}): TrustedRuntimeRequestPlan {
  const url = validateCorsOriginPolicyTarget(input.target);
  const timeoutMs = input.timeoutMs ?? input.budget.perRequestTimeoutMs;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > input.budget.perRequestTimeoutMs) {
    throw new Error("CORS validation request timeout exceeds the authorized budget.");
  }

  return Object.freeze({
    method: "GET" as const,
    url,
    timeoutMs,
    headers: Object.freeze({
      accept: "*/*" as const,
      "user-agent": ACTIVE_RUNTIME_USER_AGENT,
      origin: SCOPEFORGE_SYNTHETIC_ORIGIN,
    }),
  });
}
