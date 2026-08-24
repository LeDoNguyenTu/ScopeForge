import type { AssetRef } from "@/packages/security-domain";

export interface RuntimeObservationBudget {
  maxRequests: number;
  maxRedirects: number;
  perRequestTimeoutMs: number;
  totalTimeoutMs: number;
  maxObservationBytes: number;
}

export interface AuthorizedRuntimeTarget {
  assetRef: AssetRef;
  kind: "web_application" | "api";
  canonicalUrl: string;
  hostname: string;
}

export type RedirectDecision =
  | { allowed: true; url: URL }
  | {
      allowed: false;
      reason: "CROSS_HOST" | "SCHEME" | "PORT" | "CREDENTIALS";
    };
