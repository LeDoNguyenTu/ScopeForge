import { describe, expect, it } from "vitest";
import { readRuntimeWorkerCapabilities } from "@/lib/runtime-workers/capabilities";

describe("Phase 6D runtime worker capabilities", () => {
  it("fails closed when environment values are absent, false, or invalid", () => {
    for (const env of [
      {},
      {
        HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED: "false",
        HOSTED_ACTIVE_CORS_WORKER_ENABLED: "false",
      },
      {
        HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED: "TRUE",
        HOSTED_ACTIVE_CORS_WORKER_ENABLED: "1",
      },
      {
        HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED: "yes",
        HOSTED_ACTIVE_CORS_WORKER_ENABLED: "enabled",
      },
    ]) {
      expect(readRuntimeWorkerCapabilities(env)).toEqual({
        passiveRuntime: false,
        activeCors: false,
      });
    }
  });

  it("enables each capability independently only for the exact value true", () => {
    expect(readRuntimeWorkerCapabilities({
      HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED: "true",
    })).toEqual({ passiveRuntime: true, activeCors: false });

    expect(readRuntimeWorkerCapabilities({
      HOSTED_ACTIVE_CORS_WORKER_ENABLED: "true",
    })).toEqual({ passiveRuntime: false, activeCors: true });

    expect(readRuntimeWorkerCapabilities({
      HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED: "true",
      HOSTED_ACTIVE_CORS_WORKER_ENABLED: "true",
    })).toEqual({ passiveRuntime: true, activeCors: true });
  });
});
