import { describe, expect, it } from "vitest";
import {
  validateWorkerTaskInput,
  validateWorkerTerminalEnvelope,
  workerExecutionProfile,
} from "@/packages/worker-contracts";

const taskId = "11111111-1111-4111-8111-111111111111";
const attemptId = "22222222-2222-4222-8222-222222222222";
const domainJobId = "33333333-3333-4333-8333-333333333333";

describe("Phase 6D closed runtime worker contracts", () => {
  it("defines separate target-bound passive and active execution profiles", () => {
    expect(workerExecutionProfile("passive_runtime_observation_v1")).toEqual({
      executionClass: "passive_runtime_observation_v1",
      networkPolicy: "passive_runtime_target_bound_v1",
      budget: {
        maxWallTimeMs: 30_000,
        maxCpuTimeMs: 15_000,
        maxMemoryBytes: 268_435_456,
        maxProcesses: 1,
        maxInputFiles: 0,
        maxInputBytes: 65_536,
        maxScratchBytes: 16_777_216,
        maxOutputBytes: 131_072,
      },
    });

    expect(workerExecutionProfile("active_cors_validation_v1")).toEqual({
      executionClass: "active_cors_validation_v1",
      networkPolicy: "active_cors_target_bound_v1",
      budget: {
        maxWallTimeMs: 20_000,
        maxCpuTimeMs: 10_000,
        maxMemoryBytes: 268_435_456,
        maxProcesses: 1,
        maxInputFiles: 0,
        maxInputBytes: 32_768,
        maxScratchBytes: 8_388_608,
        maxOutputBytes: 65_536,
      },
    });
  });

  it("accepts only domain-job references as Phase 6D claimed input", () => {
    expect(validateWorkerTaskInput({
      kind: "passive_runtime_observation",
      domainJobId,
    }, "passive_runtime_observation_v1")).toEqual({
      kind: "passive_runtime_observation",
      domainJobId,
    });

    expect(validateWorkerTaskInput({
      kind: "active_cors_validation",
      domainJobId,
    }, "active_cors_validation_v1")).toEqual({
      kind: "active_cors_validation",
      domainJobId,
    });
  });

  it.each([
    ["url", "https://example.com"],
    ["hostname", "example.com"],
    ["ip", "203.0.113.10"],
    ["method", "GET"],
    ["headers", { origin: "https://attacker.invalid" }],
    ["body", "payload"],
    ["maxRedirects", 99],
    ["budget", { maxRequests: 99 }],
    ["authorization", { actorId: "user-1" }],
    ["credentials", "secret"],
  ])("rejects caller-controlled network field %s from Phase 6D input", (field, value) => {
    expect(() => validateWorkerTaskInput({
      kind: "passive_runtime_observation",
      domainJobId,
      [field]: value,
    }, "passive_runtime_observation_v1")).toThrow(/unexpected/i);

    expect(() => validateWorkerTaskInput({
      kind: "active_cors_validation",
      domainJobId,
      [field]: value,
    }, "active_cors_validation_v1")).toThrow(/unexpected/i);
  });

  it("validates a privacy-reduced passive terminal result", () => {
    const validated = validateWorkerTerminalEnvelope({
      schemaVersion: 1,
      taskId,
      attemptId,
      executionClass: "passive_runtime_observation_v1",
      outcome: "succeeded",
      failureCode: null,
      metrics: {
        wallTimeMs: 100,
        cpuTimeMs: 20,
        peakMemoryBytes: 1_048_576,
        inputBytes: 128,
        outputBytes: 512,
      },
      result: {
        kind: "passive_runtime_observation",
        requestCount: 1,
        redirectCount: 0,
        observations: [{
          kind: "header",
          name: "strict-transport-security",
          present: false,
        }],
      },
    }, {
      taskId,
      attemptId,
      executionClass: "passive_runtime_observation_v1",
    });

    expect(validated.result).toEqual({
      kind: "passive_runtime_observation",
      requestCount: 1,
      redirectCount: 0,
      observations: [{
        kind: "header",
        name: "strict-transport-security",
        present: false,
      }],
    });
  });

  it("validates an exactly-one-request active CORS terminal result", () => {
    const validated = validateWorkerTerminalEnvelope({
      schemaVersion: 1,
      taskId,
      attemptId,
      executionClass: "active_cors_validation_v1",
      outcome: "succeeded",
      failureCode: null,
      metrics: {
        wallTimeMs: 100,
        cpuTimeMs: 20,
        peakMemoryBytes: 1_048_576,
        inputBytes: 128,
        outputBytes: 512,
      },
      result: {
        kind: "active_cors_validation",
        requestCount: 1,
        observation: {
          kind: "cors-policy",
          url: "https://example.com/app",
          status: 200,
          allowedOrigin: "https://scopeforge.invalid",
          credentialsAllowed: true,
          variesOnOrigin: true,
        },
      },
    }, {
      taskId,
      attemptId,
      executionClass: "active_cors_validation_v1",
    });

    expect(validated.result).toMatchObject({
      kind: "active_cors_validation",
      requestCount: 1,
      observation: { kind: "cors-policy" },
    });
  });

  it("rejects extra terminal authority and invalid active request counts", () => {
    expect(() => validateWorkerTerminalEnvelope({
      schemaVersion: 1,
      taskId,
      attemptId,
      executionClass: "active_cors_validation_v1",
      outcome: "succeeded",
      failureCode: null,
      metrics: {
        wallTimeMs: 100,
        cpuTimeMs: 20,
        peakMemoryBytes: 1_048_576,
        inputBytes: 128,
        outputBytes: 512,
      },
      result: {
        kind: "active_cors_validation",
        requestCount: 2,
        observation: null,
        url: "https://example.com",
      },
    }, {
      taskId,
      attemptId,
      executionClass: "active_cors_validation_v1",
    })).toThrow();
  });

  it("keeps Phase 6D failure codes closed per execution class", () => {
    const metrics = {
      wallTimeMs: 1,
      cpuTimeMs: 1,
      peakMemoryBytes: 1,
      inputBytes: 0,
      outputBytes: 0,
    };

    expect(validateWorkerTerminalEnvelope({
      schemaVersion: 1,
      taskId,
      attemptId,
      executionClass: "passive_runtime_observation_v1",
      outcome: "failed",
      failureCode: "PASSIVE_RUNTIME_NETWORK_ERROR",
      metrics,
      result: null,
    }, {
      taskId,
      attemptId,
      executionClass: "passive_runtime_observation_v1",
    }).failureCode).toBe("PASSIVE_RUNTIME_NETWORK_ERROR");

    expect(validateWorkerTerminalEnvelope({
      schemaVersion: 1,
      taskId,
      attemptId,
      executionClass: "active_cors_validation_v1",
      outcome: "failed",
      failureCode: "ACTIVE_CORS_NETWORK_ERROR",
      metrics,
      result: null,
    }, {
      taskId,
      attemptId,
      executionClass: "active_cors_validation_v1",
    }).failureCode).toBe("ACTIVE_CORS_NETWORK_ERROR");

    expect(() => validateWorkerTerminalEnvelope({
      schemaVersion: 1,
      taskId,
      attemptId,
      executionClass: "active_cors_validation_v1",
      outcome: "failed",
      failureCode: "PASSIVE_RUNTIME_NETWORK_ERROR",
      metrics,
      result: null,
    }, {
      taskId,
      attemptId,
      executionClass: "active_cors_validation_v1",
    })).toThrow(/failure code/i);
  });
});
