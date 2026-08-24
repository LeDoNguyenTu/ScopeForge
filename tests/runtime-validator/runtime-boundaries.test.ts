import { describe, expect, it, vi } from "vitest";
import type { AssetRef } from "@/packages/security-domain";
import type {
  RuntimeNetworkResponse,
  TrustedRuntimeRequestPlan,
} from "@/packages/runtime-network";
import {
  ACTIVE_VALIDATION_MAX_BUDGET,
  validateCorsOriginPolicy,
  type AuthorizedValidationTarget,
} from "@/packages/runtime-validator";

const target: AuthorizedValidationTarget = {
  assetRef: "asset:runtime-boundaries" as AssetRef,
  kind: "web_application",
  canonicalUrl: "https://example.com/app",
  hostname: "example.com",
};

const response: RuntimeNetworkResponse = {
  status: 200,
  headers: {},
  tls: {
    protocol: "TLSv1.3",
    validFrom: null,
    validTo: null,
    subjectAltName: "DNS:example.com",
  },
};

describe("active validator runtime boundaries", () => {
  it("cancels before any transport work", async () => {
    const transport = vi.fn(async () => response);

    const result = await validateCorsOriginPolicy(target, ACTIVE_VALIDATION_MAX_BUDGET, {
      transport,
      isCancelled: async () => true,
    });

    expect(result).toEqual({ status: "cancelled", requestCount: 0 });
    expect(transport).not.toHaveBeenCalled();
  });

  it("cancels after response headers before observation construction", async () => {
    const transport = vi.fn(async () => response);
    let checks = 0;

    const result = await validateCorsOriginPolicy(target, ACTIVE_VALIDATION_MAX_BUDGET, {
      transport,
      isCancelled: async () => {
        checks += 1;
        return checks >= 2;
      },
    });

    expect(result).toEqual({ status: "cancelled", requestCount: 1 });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("does not start transport after the total deadline has expired", async () => {
    const transport = vi.fn(async () => response);
    const times = [0, 10_001];

    const result = await validateCorsOriginPolicy(target, ACTIVE_VALIDATION_MAX_BUDGET, {
      transport,
      now: () => times.shift() ?? 10_001,
    });

    expect(result).toEqual({
      status: "failed",
      requestCount: 0,
      failureCode: "TOTAL_TIMEOUT",
    });
    expect(transport).not.toHaveBeenCalled();
  });

  it("limits the network request to the remaining total budget", async () => {
    const plans: TrustedRuntimeRequestPlan[] = [];
    const transport = vi.fn(async (plan: TrustedRuntimeRequestPlan) => {
      plans.push(plan);
      return response;
    });
    const times = [0, 7_500, 7_500, 7_500];

    await validateCorsOriginPolicy(target, ACTIVE_VALIDATION_MAX_BUDGET, {
      transport,
      now: () => times.shift() ?? 7_500,
    });

    expect(plans).toHaveLength(1);
    expect(plans[0]?.timeoutMs).toBe(2_500);
  });

  it("reports a total timeout when the remaining total budget controls the failed request", async () => {
    const timeout = Object.assign(new Error("deadline"), { name: "TimeoutError" });
    const transport = vi.fn(async () => Promise.reject(timeout));
    const times = [0, 7_500];

    const result = await validateCorsOriginPolicy(target, ACTIVE_VALIDATION_MAX_BUDGET, {
      transport,
      now: () => times.shift() ?? 7_500,
    });

    expect(result).toEqual({
      status: "failed",
      requestCount: 0,
      failureCode: "TOTAL_TIMEOUT",
    });
  });
});
