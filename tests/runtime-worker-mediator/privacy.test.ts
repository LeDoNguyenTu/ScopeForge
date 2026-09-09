import { describe, expect, it } from "vitest";
import { executeActiveCorsProfile } from "@/packages/runtime-worker-mediator/active-cors";
import { executePassiveRuntimeProfile } from "@/packages/runtime-worker-mediator/passive";
import { RUNTIME_OBSERVATION_MAX_BUDGET } from "@/packages/runtime-observer";
import { ACTIVE_VALIDATION_MAX_BUDGET } from "@/packages/runtime-validator";

const target = {
  assetRef: "11111111-1111-4111-8111-111111111111" as never,
  kind: "api" as const,
  canonicalUrl: "https://api.example.com/",
  hostname: "api.example.com",
};

describe("runtime mediator privacy boundary", () => {
  it("maps passive network exceptions to a closed code without remote exception text", async () => {
    const result = await executePassiveRuntimeProfile({
      executionClass: "passive_runtime_observation_v1",
      target,
      budget: RUNTIME_OBSERVATION_MAX_BUDGET,
    }, {
      transport: async () => { throw new Error("resolver transcript secret 10.0.0.8"); },
    });

    expect(result).toEqual({
      status: "failed",
      failureCode: "PASSIVE_RUNTIME_NETWORK_ERROR",
      requestCount: 0,
      redirectCount: 0,
    });
    expect(JSON.stringify(result)).not.toContain("resolver transcript");
    expect(JSON.stringify(result)).not.toContain("10.0.0.8");
  });

  it("maps active network exceptions to a closed code without remote exception text", async () => {
    const result = await executeActiveCorsProfile({
      executionClass: "active_cors_validation_v1",
      target,
      budget: ACTIVE_VALIDATION_MAX_BUDGET,
    }, {
      transport: async () => { throw new Error("raw TLS peer detail secret"); },
    });

    expect(result).toEqual({
      status: "failed",
      failureCode: "ACTIVE_CORS_NETWORK_ERROR",
      requestCount: 0,
    });
    expect(JSON.stringify(result)).not.toContain("raw TLS peer detail");
  });
});
