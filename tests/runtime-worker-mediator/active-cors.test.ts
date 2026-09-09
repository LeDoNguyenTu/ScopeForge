import { describe, expect, it, vi } from "vitest";
import { executeActiveCorsProfile } from "@/packages/runtime-worker-mediator/active-cors";
import {
  ACTIVE_VALIDATION_MAX_BUDGET,
  CORS_ORIGIN_POLICY_PROFILE,
} from "@/packages/runtime-validator";
import type { RuntimeValidationTransport } from "@/packages/runtime-validator/validate";

const profile = {
  executionClass: "active_cors_validation_v1" as const,
  target: {
    assetRef: "11111111-1111-4111-8111-111111111111" as never,
    kind: "web_application" as const,
    canonicalUrl: "https://example.com/",
    hostname: "example.com",
  },
  budget: ACTIVE_VALIDATION_MAX_BUDGET,
};

const response = {
  status: 200,
  headers: {
    "access-control-allow-origin": "https://scopeforge.invalid",
    vary: "Origin",
  },
  tls: { protocol: "TLSv1.3", validFrom: null, validTo: null, subjectAltName: "DNS:example.com" },
};

describe("runtime mediator active CORS execution", () => {
  it("preserves the exact one-request built-in CORS plan", async () => {
    const transport = vi.fn(async (_plan: Parameters<RuntimeValidationTransport>[0]) => response);
    const result = await executeActiveCorsProfile(profile, { transport });

    expect(transport).toHaveBeenCalledTimes(1);
    const plan = transport.mock.calls[0]?.[0];
    expect(plan).toMatchObject({
      method: "GET",
      url: new URL("https://example.com/"),
      timeoutMs: ACTIVE_VALIDATION_MAX_BUDGET.perRequestTimeoutMs,
    });
    expect(plan?.headers).toMatchObject({
      origin: "https://scopeforge.invalid",
      accept: "*/*",
    });
    expect(plan?.headers).toHaveProperty("user-agent");
    expect(plan).not.toHaveProperty("body");
    expect(CORS_ORIGIN_POLICY_PROFILE).toEqual({ id: "cors-origin-policy", version: 1 });

    expect(result.status).toBe("succeeded");
    if (result.status !== "succeeded") throw new Error("expected success");
    expect(result.result.requestCount).toBe(1);
    expect(result.result.observation.kind).toBe("cors-policy");
  });

  it("performs zero requests when cancelled before execution", async () => {
    const transport = vi.fn(async () => response);
    const result = await executeActiveCorsProfile(profile, {
      transport,
      isCancelled: async () => true,
    });
    expect(result.status).toBe("cancelled");
    expect(transport).not.toHaveBeenCalled();
  });

  it("does not replay the request when cancellation arrives after the response", async () => {
    let cancellationChecks = 0;
    const transport = vi.fn(async () => response);
    const result = await executeActiveCorsProfile(profile, {
      transport,
      isCancelled: async () => ++cancellationChecks >= 2,
    });
    expect(result.status).toBe("cancelled");
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
