import type { AssetRef } from "@/packages/security-domain";

export const CORS_ORIGIN_POLICY_PROFILE = Object.freeze({
  id: "cors-origin-policy" as const,
  version: 1 as const,
});

export interface ActiveValidationBudget {
  maxRequests: number;
  maxRedirects: number;
  perRequestTimeoutMs: number;
  totalTimeoutMs: number;
  maxObservationBytes: number;
}

export interface AuthorizedValidationTarget {
  assetRef: AssetRef;
  kind: "web_application" | "api";
  canonicalUrl: string;
  hostname: string;
}

export interface CorsPolicyObservation {
  kind: "cors-policy";
  url: string;
  status: number;
  allowedOrigin: string | null;
  credentialsAllowed: boolean;
  variesOnOrigin: boolean;
}

export type CorsOriginPolicyFailureCode =
  | "REQUEST_TIMEOUT"
  | "TOTAL_TIMEOUT"
  | "NETWORK_ERROR"
  | "OBSERVATION_BUDGET";

export interface CorsOriginPolicyValidationResult {
  status: "succeeded" | "cancelled" | "failed";
  requestCount: 0 | 1;
  observation?: CorsPolicyObservation;
  failureCode?: CorsOriginPolicyFailureCode;
}
