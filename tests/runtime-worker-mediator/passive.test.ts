import { describe, expect, it, vi } from "vitest";
import { executePassiveRuntimeProfile } from "@/packages/runtime-worker-mediator/passive";
import { RUNTIME_OBSERVATION_MAX_BUDGET } from "@/packages/runtime-observer";

const profile = {
  executionClass: "passive_runtime_observation_v1" as const,
  target: {
    assetRef: "11111111-1111-4111-8111-111111111111" as never,
    kind: "web_application" as const,
    canonicalUrl: "https://example.com/",
    hostname: "example.com",
  },
  budget: RUNTIME_OBSERVATION_MAX_BUDGET,
};

function response(status = 200, headers: Record<string, string> = {}) {
  return {
    status,
    headers,
    tls: { protocol: "TLSv1.3", validFrom: null, validTo: null, subjectAltName: "DNS:example.com" },
  };
}

describe("runtime mediator passive execution", () => {
  it("preserves the existing passive request budget and normalized-only result", async () => {
    const transport = vi.fn(async () => response());
    const result = await executePassiveRuntimeProfile(profile, { transport });

    expect(transport).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("succeeded");
    if (result.status !== "succeeded") throw new Error("expected success");
    expect(result.result.requestCount).toBe(1);
    expect(result.result.redirectCount).toBe(0);
    expect(JSON.stringify(result)).not.toMatch(/rawBody|set-cookie|authorization|proxy-authorization/i);
  });

  it("stops before the first request when cancellation is already authoritative", async () => {
    const transport = vi.fn(async () => response());
    const result = await executePassiveRuntimeProfile(profile, {
      transport,
      isCancelled: async () => true,
    });
    expect(result.status).toBe("cancelled");
    expect(transport).not.toHaveBeenCalled();
  });

  it("stops subsequent redirect requests when cancellation becomes authoritative", async () => {
    let cancellationChecks = 0;
    const transport = vi.fn(async () => response(302, { location: "/next" }));
    const result = await executePassiveRuntimeProfile(profile, {
      transport,
      isCancelled: async () => ++cancellationChecks >= 2,
    });

    expect(result.status).toBe("cancelled");
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
