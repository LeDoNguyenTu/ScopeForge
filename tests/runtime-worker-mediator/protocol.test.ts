import { describe, expect, it } from "vitest";
import {
  validateRuntimeMediatorResult,
  validateRuntimeMediatorRunRequest,
} from "@/packages/runtime-worker-mediator";
import { createRuntimeMediatorSessionRegistry } from "@/packages/runtime-worker-mediator/session-registry";

const taskId = "11111111-1111-4111-8111-111111111111";
const attemptId = "22222222-2222-4222-8222-222222222222";
const nonce = "a".repeat(64);

function request(overrides: Record<string, unknown> = {}) {
  return {
    operation: "run",
    session: {
      taskId,
      attemptId,
      executionClass: "passive_runtime_observation_v1",
      nonce,
    },
    ...overrides,
  };
}

describe("Phase 6D runtime mediator protocol", () => {
  it("accepts only an opaque session identity plus the run operation", () => {
    expect(validateRuntimeMediatorRunRequest(request())).toEqual(request());

    for (const field of [
      "url",
      "hostname",
      "method",
      "headers",
      "body",
      "origin",
      "userAgent",
      "accept",
      "port",
      "redirects",
      "budget",
      "profile",
    ]) {
      expect(() => validateRuntimeMediatorRunRequest(request({ [field]: "forbidden" }))).toThrow();
    }
  });

  it("rejects network fields nested inside the session identity", () => {
    for (const field of ["url", "method", "headers", "body", "origin", "port"]) {
      expect(() => validateRuntimeMediatorRunRequest({
        operation: "run",
        session: {
          taskId,
          attemptId,
          executionClass: "active_cors_validation_v1",
          nonce,
          [field]: "forbidden",
        },
      })).toThrow();
    }
  });

  it("binds a random one-shot session to task, attempt, and execution class", () => {
    const registry = createRuntimeMediatorSessionRegistry<{ marker: string }>({
      randomBytes: () => Buffer.alloc(32, 7),
    });
    const profile = Object.freeze({ marker: "supervisor-owned" });
    const identity = registry.register({
      taskId,
      attemptId,
      executionClass: "passive_runtime_observation_v1",
      expiresAt: "2026-08-31T00:00:30.000Z",
      profile,
    });

    expect(identity).toEqual({
      taskId,
      attemptId,
      executionClass: "passive_runtime_observation_v1",
      nonce: Buffer.alloc(32, 7).toString("hex"),
    });
    expect(identity).not.toHaveProperty("profile");

    const consumed = registry.consume({ operation: "run", session: identity }, new Date("2026-08-31T00:00:10.000Z"));
    expect(consumed).toBe(profile);
    expect(() => registry.consume({ operation: "run", session: identity }, new Date("2026-08-31T00:00:11.000Z"))).toThrow();
  });

  it("rejects wrong, expired, and cross-class session identities", () => {
    const registry = createRuntimeMediatorSessionRegistry<{ marker: string }>({
      randomBytes: () => Buffer.alloc(32, 9),
    });
    const identity = registry.register({
      taskId,
      attemptId,
      executionClass: "active_cors_validation_v1",
      expiresAt: "2026-08-31T00:00:20.000Z",
      profile: { marker: "active" },
    });

    expect(() => registry.consume({
      operation: "run",
      session: { ...identity, attemptId: "33333333-3333-4333-8333-333333333333" },
    }, new Date("2026-08-31T00:00:10.000Z"))).toThrow();

    expect(() => registry.consume({
      operation: "run",
      session: { ...identity, executionClass: "passive_runtime_observation_v1" },
    }, new Date("2026-08-31T00:00:10.000Z"))).toThrow();

    expect(() => registry.consume({ operation: "run", session: identity }, new Date("2026-08-31T00:00:20.000Z"))).toThrow();
  });

  it("accepts only normalized passive observations and rejects raw response material", () => {
    const valid = {
      kind: "passive_runtime_observation",
      requestCount: 1,
      redirectCount: 0,
      observations: [
        { kind: "http-status", url: "https://example.com/", status: 200 },
        { kind: "header", name: "content-type", present: true, value: "text/html" },
        { kind: "cookie", name: "session", secure: true, httpOnly: true, sameSite: "Lax" },
        { kind: "tls", protocol: "TLSv1.3", validFrom: null, validTo: null, sanCount: 1, hostnameMatches: true },
      ],
    };
    expect(validateRuntimeMediatorResult(valid, "passive_runtime_observation_v1")).toEqual(valid);

    expect(() => validateRuntimeMediatorResult({ ...valid, rawBody: "secret" }, "passive_runtime_observation_v1")).toThrow();
    expect(() => validateRuntimeMediatorResult({
      ...valid,
      observations: [{ kind: "http-status", url: "https://example.com/", status: 200, headers: { "set-cookie": "secret" } }],
    }, "passive_runtime_observation_v1")).toThrow();
  });

  it("accepts only one normalized active CORS observation and rejects raw headers/body", () => {
    const valid = {
      kind: "active_cors_validation",
      requestCount: 1,
      observation: {
        kind: "cors-policy",
        url: "https://example.com/",
        status: 200,
        allowedOrigin: "https://scopeforge.invalid",
        credentialsAllowed: false,
        variesOnOrigin: true,
      },
    };
    expect(validateRuntimeMediatorResult(valid, "active_cors_validation_v1")).toEqual(valid);
    expect(() => validateRuntimeMediatorResult({ ...valid, body: "secret" }, "active_cors_validation_v1")).toThrow();
    expect(() => validateRuntimeMediatorResult({
      ...valid,
      observation: { ...valid.observation, headers: { server: "raw" } },
    }, "active_cors_validation_v1")).toThrow();
  });

  it("enforces an independent serialized result ceiling", () => {
    const oversized = {
      kind: "passive_runtime_observation",
      requestCount: 4,
      redirectCount: 3,
      observations: Array.from({ length: 140 }, (_, index) => ({
        kind: "header",
        name: "content-security-policy",
        present: true,
        value: `${index}-`.padEnd(1_024, "x"),
      })),
    };
    expect(() => validateRuntimeMediatorResult(oversized, "passive_runtime_observation_v1")).toThrow();
  });
});
