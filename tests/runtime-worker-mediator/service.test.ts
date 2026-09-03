import { describe, expect, it, vi } from "vitest";
import { createRuntimeMediatorService } from "@/packages/runtime-worker-mediator/service";
import { RUNTIME_OBSERVATION_MAX_BUDGET } from "@/packages/runtime-observer";

const identity = {
  taskId: "11111111-1111-4111-8111-111111111111",
  attemptId: "22222222-2222-4222-8222-222222222222",
  executionClass: "passive_runtime_observation_v1" as const,
  nonce: "a".repeat(64),
};

const passiveProfile = {
  executionClass: "passive_runtime_observation_v1" as const,
  target: {
    assetRef: "33333333-3333-4333-8333-333333333333" as never,
    kind: "web_application" as const,
    canonicalUrl: "https://example.com/",
    hostname: "example.com",
  },
  budget: RUNTIME_OBSERVATION_MAX_BUDGET,
};

describe("runtime mediator service", () => {
  it("dispatches exclusively from the consumed supervisor profile", async () => {
    const consume = vi.fn(() => passiveProfile);
    const transport = vi.fn(async () => ({
      status: 200,
      headers: {},
      tls: { protocol: "TLSv1.3", validFrom: null, validTo: null, subjectAltName: "DNS:example.com" },
    }));
    const service = createRuntimeMediatorService({
      registry: { consume },
      passive: { transport },
      now: () => new Date("2026-08-31T00:00:10.000Z"),
    });

    const request = { operation: "run" as const, session: identity };
    const result = await service.run(request);

    expect(consume).toHaveBeenCalledWith(request, new Date("2026-08-31T00:00:10.000Z"));
    expect(transport).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("succeeded");
    expect(JSON.stringify(result)).not.toContain("nonce");
    expect(JSON.stringify(result)).not.toContain("canonicalUrl");
  });
});
