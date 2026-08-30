import { describe, expect, it } from "vitest";
import { validateRuntimeMediatorWireResponse } from "@/packages/runtime-worker-mediator/unix-client";

describe("runtime mediator Unix response schema", () => {
  it("accepts a closed passive failure and rejects raw error text", () => {
    expect(validateRuntimeMediatorWireResponse({
      status: "failed",
      failureCode: "PASSIVE_RUNTIME_NETWORK_ERROR",
      requestCount: 0,
      redirectCount: 0,
    }, "passive_runtime_observation_v1")).toEqual({
      status: "failed",
      failureCode: "PASSIVE_RUNTIME_NETWORK_ERROR",
      requestCount: 0,
      redirectCount: 0,
    });

    expect(() => validateRuntimeMediatorWireResponse({
      status: "failed",
      failureCode: "PASSIVE_RUNTIME_NETWORK_ERROR",
      requestCount: 0,
      redirectCount: 0,
      error: "raw resolver transcript",
    }, "passive_runtime_observation_v1")).toThrow();
  });

  it("accepts only the active class failure-code set", () => {
    expect(() => validateRuntimeMediatorWireResponse({
      status: "failed",
      failureCode: "PASSIVE_RUNTIME_NETWORK_ERROR",
      requestCount: 0,
    }, "active_cors_validation_v1")).toThrow();
  });
});
