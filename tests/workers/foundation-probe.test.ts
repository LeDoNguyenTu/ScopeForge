import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { executeFoundationProbe } from "@/packages/worker-supervisor/foundation-probe";
import type { WorkerExecutorContract } from "@/packages/worker-supervisor";

const contract: WorkerExecutorContract = {
  taskId: "33333333-3333-4333-8333-333333333333",
  attemptId: "44444444-4444-4444-8444-444444444444",
  executionClass: "foundation_no_egress_v1",
  absoluteDeadlineAt: "2026-08-26T00:05:00.000Z",
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
  input: { kind: "foundation_probe", nonce: "abc" },
};

describe("foundation worker probe", () => {
  it("hashes only the supplied nonce and returns a bounded deterministic result", async () => {
    const result = await executeFoundationProbe(contract, new AbortController().signal);
    expect(result).toEqual({
      schemaVersion: 1,
      taskId: contract.taskId,
      attemptId: contract.attemptId,
      executionClass: "foundation_no_egress_v1",
      outcome: "succeeded",
      failureCode: null,
      metrics: {
        wallTimeMs: 0,
        cpuTimeMs: 0,
        peakMemoryBytes: 0,
        inputBytes: 3,
        outputBytes: 64,
      },
      result: {
        kind: "foundation_probe",
        nonceDigest: createHash("sha256").update("abc", "utf8").digest("hex"),
      },
    });
  });

  it("returns cancellation without running when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(executeFoundationProbe(contract, controller.signal)).resolves.toMatchObject({
      outcome: "cancelled",
      failureCode: null,
      result: null,
    });
  });
});
