import { describe, expect, it } from "vitest";
import { validateWorkerTerminalEnvelope } from "@/packages/worker-contracts";

const taskId = "11111111-1111-4111-8111-111111111111";
const attemptId = "22222222-2222-4222-8222-222222222222";
const metrics = {
  wallTimeMs: 100,
  cpuTimeMs: 20,
  peakMemoryBytes: 1_048_576,
  inputBytes: 128,
  outputBytes: 512,
};

function passiveTerminal(observation: Record<string, unknown>) {
  return {
    schemaVersion: 1,
    taskId,
    attemptId,
    executionClass: "passive_runtime_observation_v1",
    outcome: "succeeded",
    failureCode: null,
    metrics,
    result: {
      kind: "passive_runtime_observation",
      requestCount: 1,
      redirectCount: 0,
      observations: [observation],
    },
  };
}

function activeTerminal(observation: Record<string, unknown>) {
  return {
    schemaVersion: 1,
    taskId,
    attemptId,
    executionClass: "active_cors_validation_v1",
    outcome: "succeeded",
    failureCode: null,
    metrics,
    result: {
      kind: "active_cors_validation",
      requestCount: 1,
      observation,
    },
  };
}

describe("Phase 6D nested runtime result boundary", () => {
  it("rejects extra fields and unrestricted header names in passive observations", () => {
    expect(() => validateWorkerTerminalEnvelope(passiveTerminal({
      kind: "http-status",
      url: "https://example.com/",
      status: 200,
      rawBody: "secret",
    }), {
      taskId,
      attemptId,
      executionClass: "passive_runtime_observation_v1",
    })).toThrow();

    expect(() => validateWorkerTerminalEnvelope(passiveTerminal({
      kind: "header",
      name: "authorization",
      present: true,
      value: "Bearer secret",
    }), {
      taskId,
      attemptId,
      executionClass: "passive_runtime_observation_v1",
    })).toThrow();
  });

  it("rejects raw cookie values in passive observations", () => {
    expect(() => validateWorkerTerminalEnvelope(passiveTerminal({
      kind: "cookie",
      name: "session",
      secure: true,
      httpOnly: true,
      sameSite: "Lax",
      value: "sensitive-cookie-value",
    }), {
      taskId,
      attemptId,
      executionClass: "passive_runtime_observation_v1",
    })).toThrow();
  });

  it("rejects extra or malformed fields in active CORS observations", () => {
    expect(() => validateWorkerTerminalEnvelope(activeTerminal({
      kind: "cors-policy",
      url: "https://example.com/",
      status: 200,
      allowedOrigin: "https://scopeforge.invalid",
      credentialsAllowed: true,
      variesOnOrigin: true,
      responseBody: "secret",
    }), {
      taskId,
      attemptId,
      executionClass: "active_cors_validation_v1",
    })).toThrow();

    expect(() => validateWorkerTerminalEnvelope(activeTerminal({
      kind: "cors-policy",
      url: "https://example.com/",
      status: 99,
      allowedOrigin: null,
      credentialsAllowed: false,
      variesOnOrigin: false,
    }), {
      taskId,
      attemptId,
      executionClass: "active_cors_validation_v1",
    })).toThrow();
  });
});
