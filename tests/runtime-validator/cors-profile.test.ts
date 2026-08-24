import { describe, expect, it, vi } from "vitest";
import type { AssetRef } from "@/packages/security-domain";
import {
  ACTIVE_VALIDATION_MAX_BUDGET,
  CORS_ORIGIN_POLICY_PROFILE,
  buildCorsPolicyObservation,
  validateActiveValidationBudget,
  validateCorsOriginPolicy,
  validateCorsOriginPolicyTarget,
  type AuthorizedValidationTarget,
} from "@/packages/runtime-validator";
import {
  ACTIVE_RUNTIME_USER_AGENT,
  SCOPEFORGE_SYNTHETIC_ORIGIN,
  type RuntimeNetworkResponse,
  type TrustedRuntimeRequestPlan,
} from "@/packages/runtime-network";

const target: AuthorizedValidationTarget = {
  assetRef: "asset:test-web" as AssetRef,
  kind: "web_application",
  canonicalUrl: "https://example.com/app",
  hostname: "example.com",
};

const budget = {
  maxRequests: 1,
  maxRedirects: 0,
  perRequestTimeoutMs: 5_000,
  totalTimeoutMs: 10_000,
  maxObservationBytes: 32_768,
} as const;

const response: RuntimeNetworkResponse = {
  status: 200,
  headers: {
    "access-control-allow-origin": SCOPEFORGE_SYNTHETIC_ORIGIN,
    "access-control-allow-credentials": "true",
    vary: "Accept-Encoding, Origin",
    "set-cookie": "session=super-secret; Secure; HttpOnly",
    "x-secret-debug": "do-not-persist",
  },
  tls: {
    protocol: "TLSv1.3",
    validFrom: null,
    validTo: null,
    subjectAltName: "DNS:example.com",
  },
};

describe("bounded CORS origin-policy validator", () => {
  it("locks the built-in profile and active budget ceilings", () => {
    expect(CORS_ORIGIN_POLICY_PROFILE).toEqual({ id: "cors-origin-policy", version: 1 });
    expect(ACTIVE_VALIDATION_MAX_BUDGET).toEqual(budget);
    expect(validateActiveValidationBudget(budget)).toEqual(budget);

    expect(() => validateActiveValidationBudget({ ...budget, maxRequests: 2 })).toThrow(/request/i);
    expect(() => validateActiveValidationBudget({ ...budget, maxRedirects: 1 })).toThrow(/redirect/i);
    expect(() => validateActiveValidationBudget({ ...budget, perRequestTimeoutMs: 5_001 })).toThrow(/timeout/i);
    expect(() => validateActiveValidationBudget({ ...budget, totalTimeoutMs: 10_001 })).toThrow(/timeout/i);
    expect(() => validateActiveValidationBudget({ ...budget, maxObservationBytes: 32_769 })).toThrow(/observation/i);
  });

  it("accepts only the exact verified HTTPS target boundary", () => {
    expect(validateCorsOriginPolicyTarget(target).toString()).toBe("https://example.com/app");
    expect(() => validateCorsOriginPolicyTarget({ ...target, canonicalUrl: "http://example.com/app" })).toThrow(/https/i);
    expect(() => validateCorsOriginPolicyTarget({ ...target, canonicalUrl: "https://example.com:444/app" })).toThrow(/443/i);
    expect(() => validateCorsOriginPolicyTarget({ ...target, canonicalUrl: "https://other.example/app" })).toThrow(/hostname/i);
    expect(() => validateCorsOriginPolicyTarget({ ...target, canonicalUrl: "https://example.com/app?token=secret" })).toThrow(/query/i);
    expect(() => validateCorsOriginPolicyTarget({ ...target, canonicalUrl: "https://example.com/app#secret" })).toThrow(/fragment/i);
  });

  it("normalizes only bounded CORS metadata and redacts URL secrets", () => {
    const observation = buildCorsPolicyObservation({
      url: new URL("https://example.com/app?token=super-secret#fragment"),
      response,
    });

    expect(observation).toEqual({
      kind: "cors-policy",
      url: "https://example.com/app",
      status: 200,
      allowedOrigin: SCOPEFORGE_SYNTHETIC_ORIGIN,
      credentialsAllowed: true,
      variesOnOrigin: true,
    });
    expect(JSON.stringify(observation)).not.toContain("super-secret");
    expect(JSON.stringify(observation)).not.toContain("session=");
    expect(JSON.stringify(observation)).not.toContain("do-not-persist");
  });

  it("makes exactly one fixed-origin GET and never follows a redirect", async () => {
    const plans: TrustedRuntimeRequestPlan[] = [];
    const transport = vi.fn(async (plan: TrustedRuntimeRequestPlan): Promise<RuntimeNetworkResponse> => {
      plans.push(plan);
      return {
        ...response,
        status: 302,
        headers: {
          ...response.headers,
          location: "https://example.com/next",
        },
      };
    });

    const result = await validateCorsOriginPolicy(target, budget, { transport });

    expect(result.status).toBe("succeeded");
    expect(result.requestCount).toBe(1);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      method: "GET",
      timeoutMs: 5_000,
      headers: {
        accept: "*/*",
        "user-agent": ACTIVE_RUNTIME_USER_AGENT,
        origin: SCOPEFORGE_SYNTHETIC_ORIGIN,
      },
    });
    expect(plans[0]?.url.toString()).toBe("https://example.com/app");
    expect(result.observation?.status).toBe(302);
    expect(JSON.stringify(result)).not.toContain("location");
  });
});
