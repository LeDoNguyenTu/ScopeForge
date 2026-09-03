import { describe, expect, it } from "vitest";
import { validateRuntimeWorkerTerminal } from "@/lib/runtime-workers/result-validation";

const taskId = "11111111-1111-4111-8111-111111111111";
const attemptId = "22222222-2222-4222-8222-222222222222";

const metrics = Object.freeze({
  wallTimeMs: 1,
  cpuTimeMs: 0,
  peakMemoryBytes: 0,
  inputBytes: 0,
  outputBytes: 128,
});

function terminal(result: unknown, executionClass: "passive_runtime_observation_v1" | "active_cors_validation_v1") {
  return {
    schemaVersion: 1,
    taskId,
    attemptId,
    executionClass,
    outcome: "succeeded",
    failureCode: null,
    metrics,
    result,
  };
}

describe("Phase 6D trusted terminal validation", () => {
  it("accepts bounded normalized passive observations only", () => {
    const value = terminal({
      kind: "passive_runtime_observation",
      requestCount: 1,
      redirectCount: 0,
      observations: [
        { kind: "http-status", url: "https://example.com/", status: 200 },
        { kind: "header", name: "content-type", present: true, value: "text/html" },
      ],
    }, "passive_runtime_observation_v1");

    expect(validateRuntimeWorkerTerminal(value, {
      taskId,
      attemptId,
      executionClass: "passive_runtime_observation_v1",
    })).toEqual(value);
  });

  it("rejects passive request, redirect, observation-byte, and raw-response widening", () => {
    const base = {
      kind: "passive_runtime_observation",
      requestCount: 1,
      redirectCount: 0,
      observations: [{ kind: "http-status", url: "https://example.com/", status: 200 }],
    };
    for (const result of [
      { ...base, requestCount: 5 },
      { ...base, redirectCount: 4 },
      { ...base, rawBody: "secret" },
      { ...base, observations: [{ ...base.observations[0], headers: { authorization: "secret" } }] },
      { ...base, observations: Array.from({ length: 80 }, () => ({
        kind: "header", name: "content-security-policy", present: true, value: "x".repeat(1024),
      })) },
    ]) {
      expect(() => validateRuntimeWorkerTerminal(terminal(result, "passive_runtime_observation_v1"), {
        taskId,
        attemptId,
        executionClass: "passive_runtime_observation_v1",
      })).toThrow();
    }
  });

  it("accepts exactly one normalized active CORS observation", () => {
    const value = terminal({
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
    }, "active_cors_validation_v1");

    expect(validateRuntimeWorkerTerminal(value, {
      taskId,
      attemptId,
      executionClass: "active_cors_validation_v1",
    })).toEqual(value);
  });

  it("rejects active success with zero/two requests, missing observation, or raw fields", () => {
    const observation = {
      kind: "cors-policy",
      url: "https://example.com/",
      status: 200,
      allowedOrigin: null,
      credentialsAllowed: false,
      variesOnOrigin: false,
    };
    for (const result of [
      { kind: "active_cors_validation", requestCount: 0, observation },
      { kind: "active_cors_validation", requestCount: 2, observation },
      { kind: "active_cors_validation", requestCount: 1 },
      { kind: "active_cors_validation", requestCount: 1, observation: { ...observation, headers: { server: "raw" } } },
    ]) {
      expect(() => validateRuntimeWorkerTerminal(terminal(result, "active_cors_validation_v1"), {
        taskId,
        attemptId,
        executionClass: "active_cors_validation_v1",
      })).toThrow();
    }
  });

  it("rejects task, attempt, and class mismatches before publication", () => {
    const value = terminal({
      kind: "passive_runtime_observation",
      requestCount: 0,
      redirectCount: 0,
      observations: [],
    }, "passive_runtime_observation_v1");

    expect(() => validateRuntimeWorkerTerminal(value, {
      taskId: "33333333-3333-4333-8333-333333333333",
      attemptId,
      executionClass: "passive_runtime_observation_v1",
    })).toThrow();
    expect(() => validateRuntimeWorkerTerminal(value, {
      taskId,
      attemptId,
      executionClass: "active_cors_validation_v1",
    })).toThrow();
  });
});
