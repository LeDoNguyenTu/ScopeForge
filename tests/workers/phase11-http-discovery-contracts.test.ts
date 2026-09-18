import { describe, expect, it } from "vitest";
import {
  validatePhase11HttpDiscoveryTaskInput,
  validatePhase11HttpDiscoveryTerminalEnvelope,
  workerExecutionProfile,
} from "@/packages/worker-contracts";

const taskId = "11111111-1111-4111-8111-111111111111";
const attemptId = "22222222-2222-4222-8222-222222222222";
const runId = "33333333-3333-4333-8333-333333333333";
const actionId = "phase11-action:" + "a".repeat(64);
const authorizationId = "phase11-authz:" + "b".repeat(64);

describe("Phase 11C HTTP discovery worker contract", () => {
  it("defines a closed default-off execution profile", () => {
    expect(workerExecutionProfile("phase11_http_discovery_v1")).toEqual({
      executionClass: "phase11_http_discovery_v1",
      networkPolicy: "phase11_http_discovery_target_bound_v1",
      budget: {
        maxWallTimeMs: 30_000,
        maxCpuTimeMs: 15_000,
        maxMemoryBytes: 268_435_456,
        maxProcesses: 1,
        maxInputFiles: 0,
        maxInputBytes: 4_096,
        maxScratchBytes: 8_388_608,
        maxOutputBytes: 32_768,
      },
    });
  });

  it("accepts only immutable Phase 11 identity references as claimed input", () => {
    expect(validatePhase11HttpDiscoveryTaskInput({
      kind: "phase11_http_discovery",
      runId,
      actionId,
      authorizationId,
    })).toEqual({
      kind: "phase11_http_discovery",
      runId,
      actionId,
      authorizationId,
    });
  });

  it.each([
    ["url", "https://example.com"],
    ["hostname", "example.com"],
    ["path", "/admin"],
    ["headers", { authorization: "secret" }],
    ["body", "payload"],
    ["method", "POST"],
    ["providerArgs", ["--unsafe"]],
    ["executionClass", "foundation_no_egress_v1"],
    ["networkPolicy", "none"],
    ["budget", { maxRequests: 999 }],
    ["targetNodeId", "node-1"],
  ])("rejects caller-controlled runtime authority field %s", (field, value) => {
    expect(() => validatePhase11HttpDiscoveryTaskInput({
      kind: "phase11_http_discovery",
      runId,
      actionId,
      authorizationId,
      [field]: value,
    })).toThrow(/unexpected/i);
  });

  it("rejects malformed Phase 11 action and authorization identities", () => {
    expect(() => validatePhase11HttpDiscoveryTaskInput({
      kind: "phase11_http_discovery",
      runId,
      actionId: "action-1",
      authorizationId,
    })).toThrow(/action/i);

    expect(() => validatePhase11HttpDiscoveryTaskInput({
      kind: "phase11_http_discovery",
      runId,
      actionId,
      authorizationId: "auth-1",
    })).toThrow(/authorization/i);
  });

  it("validates only privacy-reduced HTTP discovery terminal records", () => {
    const terminal = validatePhase11HttpDiscoveryTerminalEnvelope({
      schemaVersion: 1,
      taskId,
      attemptId,
      executionClass: "phase11_http_discovery_v1",
      outcome: "succeeded",
      failureCode: null,
      metrics: {
        wallTimeMs: 100,
        cpuTimeMs: 10,
        peakMemoryBytes: 1_048_576,
        inputBytes: 256,
        outputBytes: 512,
      },
      result: {
        kind: "phase11_http_discovery",
        requestCount: 2,
        records: [{
          routeKind: "root",
          status: 200,
          contentType: "text/html",
          redirected: false,
        }],
      },
    }, { taskId, attemptId });

    expect(terminal.result).toEqual({
      kind: "phase11_http_discovery",
      requestCount: 2,
      records: [{
        routeKind: "root",
        status: 200,
        contentType: "text/html",
        redirected: false,
      }],
    });
  });

  it("rejects terminal URL/body/header authority and impossible redirect state", () => {
    const base = {
      schemaVersion: 1,
      taskId,
      attemptId,
      executionClass: "phase11_http_discovery_v1",
      outcome: "succeeded",
      failureCode: null,
      metrics: {
        wallTimeMs: 100,
        cpuTimeMs: 10,
        peakMemoryBytes: 1_048_576,
        inputBytes: 256,
        outputBytes: 512,
      },
    };

    expect(() => validatePhase11HttpDiscoveryTerminalEnvelope({
      ...base,
      result: {
        kind: "phase11_http_discovery",
        requestCount: 1,
        records: [{
          routeKind: "root",
          status: 200,
          redirected: false,
          url: "https://example.com",
        }],
      },
    }, { taskId, attemptId })).toThrow(/unexpected/i);

    expect(() => validatePhase11HttpDiscoveryTerminalEnvelope({
      ...base,
      result: {
        kind: "phase11_http_discovery",
        requestCount: 1,
        records: [{
          routeKind: "root",
          status: 302,
          redirected: true,
          redirectBlockedReason: "CROSS_HOST",
        }],
      },
    }, { taskId, attemptId })).toThrow(/redirect/i);
  });

  it("keeps failure codes closed and cancellation payload-free", () => {
    const metrics = {
      wallTimeMs: 1,
      cpuTimeMs: 1,
      peakMemoryBytes: 1,
      inputBytes: 0,
      outputBytes: 0,
    };

    expect(validatePhase11HttpDiscoveryTerminalEnvelope({
      schemaVersion: 1,
      taskId,
      attemptId,
      executionClass: "phase11_http_discovery_v1",
      outcome: "failed",
      failureCode: "HTTP_DISCOVERY_NETWORK_ERROR",
      metrics,
      result: null,
    }, { taskId, attemptId }).failureCode).toBe("HTTP_DISCOVERY_NETWORK_ERROR");

    expect(validatePhase11HttpDiscoveryTerminalEnvelope({
      schemaVersion: 1,
      taskId,
      attemptId,
      executionClass: "phase11_http_discovery_v1",
      outcome: "cancelled",
      failureCode: null,
      metrics,
      result: null,
    }, { taskId, attemptId }).outcome).toBe("cancelled");

    expect(() => validatePhase11HttpDiscoveryTerminalEnvelope({
      schemaVersion: 1,
      taskId,
      attemptId,
      executionClass: "phase11_http_discovery_v1",
      outcome: "failed",
      failureCode: "PASSIVE_RUNTIME_NETWORK_ERROR",
      metrics,
      result: null,
    }, { taskId, attemptId })).toThrow(/failure code/i);
  });
});
