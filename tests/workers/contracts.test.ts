import { describe, expect, it } from "vitest";
import {
  validateWorkerTerminalEnvelope,
  workerExecutionProfile,
} from "@/packages/worker-contracts";

describe("Phase 6A worker contracts", () => {
  it("keeps the only execution class closed and zero-egress", () => {
    expect(workerExecutionProfile("foundation_no_egress_v1")).toEqual({
      executionClass: "foundation_no_egress_v1",
      networkPolicy: "none",
      budget: {
        maxWallTimeMs: 30_000,
        maxCpuTimeMs: 20_000,
        maxMemoryBytes: 268_435_456,
        maxProcesses: 4,
        maxInputFiles: 100,
        maxInputBytes: 10_485_760,
        maxScratchBytes: 33_554_432,
        maxOutputBytes: 1_048_576,
      },
    });
  });

  it("validates an exactly-bound successful terminal envelope", () => {
    expect(validateWorkerTerminalEnvelope({
      schemaVersion: 1,
      taskId: "11111111-1111-4111-8111-111111111111",
      attemptId: "22222222-2222-4222-8222-222222222222",
      executionClass: "foundation_no_egress_v1",
      outcome: "succeeded",
      failureCode: null,
      metrics: {
        wallTimeMs: 12,
        cpuTimeMs: 7,
        peakMemoryBytes: 4096,
        inputBytes: 3,
        outputBytes: 64,
      },
      result: { kind: "foundation_probe", nonceDigest: "a".repeat(64) },
    }, {
      taskId: "11111111-1111-4111-8111-111111111111",
      attemptId: "22222222-2222-4222-8222-222222222222",
      executionClass: "foundation_no_egress_v1",
    })).toMatchObject({
      outcome: "succeeded",
      failureCode: null,
    });
  });

  it("rejects unexpected execution-authority fields", () => {
    expect(() => validateWorkerTerminalEnvelope({
      schemaVersion: 1,
      taskId: "11111111-1111-4111-8111-111111111111",
      attemptId: "22222222-2222-4222-8222-222222222222",
      executionClass: "foundation_no_egress_v1",
      outcome: "succeeded",
      failureCode: null,
      metrics: {
        wallTimeMs: 1,
        cpuTimeMs: 1,
        peakMemoryBytes: 1,
        inputBytes: 0,
        outputBytes: 0,
      },
      result: { kind: "foundation_probe", nonceDigest: "b".repeat(64) },
      command: "curl https://example.com",
    }, {
      taskId: "11111111-1111-4111-8111-111111111111",
      attemptId: "22222222-2222-4222-8222-222222222222",
      executionClass: "foundation_no_egress_v1",
    })).toThrow(/unexpected/i);
  });

  it("rejects cross-attempt replay and invalid failure codes", () => {
    const envelope = {
      schemaVersion: 1,
      taskId: "11111111-1111-4111-8111-111111111111",
      attemptId: "22222222-2222-4222-8222-222222222222",
      executionClass: "foundation_no_egress_v1",
      outcome: "failed",
      failureCode: "WORKER_EXECUTION_FAILED",
      metrics: {
        wallTimeMs: 1,
        cpuTimeMs: 1,
        peakMemoryBytes: 1,
        inputBytes: 0,
        outputBytes: 0,
      },
      result: null,
    };

    expect(() => validateWorkerTerminalEnvelope(envelope, {
      taskId: envelope.taskId,
      attemptId: "33333333-3333-4333-8333-333333333333",
      executionClass: "foundation_no_egress_v1",
    })).toThrow(/attempt/i);

    expect(() => validateWorkerTerminalEnvelope({
      ...envelope,
      failureCode: "x".repeat(65),
    }, {
      taskId: envelope.taskId,
      attemptId: envelope.attemptId,
      executionClass: "foundation_no_egress_v1",
    })).toThrow(/failure code/i);
  });

  it("rejects metrics outside the closed profile budget", () => {
    expect(() => validateWorkerTerminalEnvelope({
      schemaVersion: 1,
      taskId: "11111111-1111-4111-8111-111111111111",
      attemptId: "22222222-2222-4222-8222-222222222222",
      executionClass: "foundation_no_egress_v1",
      outcome: "failed",
      failureCode: "WORKER_BUDGET_EXCEEDED",
      metrics: {
        wallTimeMs: 30_001,
        cpuTimeMs: 1,
        peakMemoryBytes: 1,
        inputBytes: 0,
        outputBytes: 0,
      },
      result: null,
    }, {
      taskId: "11111111-1111-4111-8111-111111111111",
      attemptId: "22222222-2222-4222-8222-222222222222",
      executionClass: "foundation_no_egress_v1",
    })).toThrow(/budget/i);
  });
});
