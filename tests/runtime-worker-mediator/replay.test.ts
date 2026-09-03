import { describe, expect, it } from "vitest";
import { createRuntimeMediatorSessionRegistry } from "@/packages/runtime-worker-mediator/session-registry";

const registration = {
  taskId: "11111111-1111-4111-8111-111111111111",
  attemptId: "22222222-2222-4222-8222-222222222222",
  executionClass: "passive_runtime_observation_v1" as const,
  expiresAt: "2026-08-31T00:00:30.000Z",
  profile: { marker: "prepared" },
};

describe("runtime mediator replay boundary", () => {
  it("never permits a second mediator session for the same worker attempt after consumption", () => {
    const registry = createRuntimeMediatorSessionRegistry<{ marker: string }>({
      randomBytes: () => Buffer.alloc(32, 3),
    });
    const identity = registry.register(registration);
    registry.consume({ operation: "run", session: identity }, new Date("2026-08-31T00:00:10.000Z"));

    expect(() => registry.register(registration)).toThrow();
  });

  it("never permits a second mediator session for the same worker attempt after expiry", () => {
    const registry = createRuntimeMediatorSessionRegistry<{ marker: string }>({
      randomBytes: () => Buffer.alloc(32, 4),
    });
    const identity = registry.register(registration);
    expect(() => registry.consume(
      { operation: "run", session: identity },
      new Date("2026-08-31T00:00:30.000Z"),
    )).toThrow();

    expect(() => registry.register(registration)).toThrow();
  });
});
