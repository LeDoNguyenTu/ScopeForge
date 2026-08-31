import { describe, expect, it, vi } from "vitest";
import {
  createRuntimeNetworkPreparer,
  runWorkerOnce,
} from "@/packages/worker-supervisor";
import type { WorkerTaskContract } from "@/packages/worker-contracts";
import { ACTIVE_VALIDATION_MAX_BUDGET } from "@/packages/runtime-validator";
import type { PreparedRuntimeWorkerExecution } from "@/packages/worker-supervisor/control-client";

const taskId = "11111111-1111-4111-8111-111111111111";
const attemptId = "22222222-2222-4222-8222-222222222222";
const jobId = "33333333-3333-4333-8333-333333333333";
const leaseToken = "a".repeat(64);
const deadline = "2099-08-31T00:00:20.000Z";

const task: WorkerTaskContract = {
  taskId,
  attemptId,
  executionClass: "active_cors_validation_v1",
  leaseToken,
  absoluteDeadlineAt: deadline,
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
  input: {
    kind: "active_cors_validation",
    domainJobId: jobId,
  },
};

const prepared: PreparedRuntimeWorkerExecution = {
  taskId,
  attemptId,
  executionClass: "active_cors_validation_v1",
  domainJobId: jobId,
  expiresAt: deadline,
  target: {
    assetRef: "44444444-4444-4444-8444-444444444444",
    kind: "web_application",
    canonicalUrl: "https://example.com",
    hostname: "example.com",
  },
  budget: ACTIVE_VALIDATION_MAX_BUDGET,
};

describe("Phase 6D authoritative cancellation probing", () => {
  it("rechecks authoritative cancellation after trusted preparation and before mediator startup", async () => {
    const start = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    const preparer = createRuntimeNetworkPreparer({
      randomBytes: () => Buffer.alloc(32, 7),
      now: () => new Date("2099-08-30T23:59:59.000Z"),
      createUnixServer: () => ({ start, close }),
    });
    const controller = new AbortController();
    const isCancelled = vi.fn(async () => true);

    await expect(preparer.prepare({
      task,
      prepared,
      signal: controller.signal,
      isCancelled,
    })).rejects.toMatchObject({ name: "AbortError" });

    expect(isCancelled).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("uses the authenticated lease heartbeat as the Phase 6D semantic cancellation probe", async () => {
    const heartbeat = vi.fn(async () => ({
      cancelRequested: true,
      leaseExpiresAt: deadline,
    }));
    const execute = vi.fn();
    const runtimeFinalize = vi.fn(async () => ({
      outcome: "cancelled" as const,
      replayed: false,
    }));
    const runtimeNetworkPreparer = {
      prepare: vi.fn(async (input) => {
        expect(typeof input.isCancelled).toBe("function");
        expect(await input.isCancelled()).toBe(true);
        throw new DOMException("cancelled", "AbortError");
      }),
    };

    await expect(runWorkerOnce({
      control: {
        claim: vi.fn(async () => task),
        runtimePrepare: vi.fn(async () => prepared),
        runtimeFinalize,
        heartbeat,
        finalize: vi.fn(),
      },
      executor: { execute },
      runtimeNetworkPreparer,
      heartbeatMs: 60_000,
    })).resolves.toEqual({
      status: "completed",
      outcome: "cancelled",
      replayed: false,
    });

    expect(heartbeat).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();
    expect(runtimeFinalize).toHaveBeenCalledWith(expect.objectContaining({
      taskId,
      attemptId,
      leaseToken,
      terminal: expect.objectContaining({
        outcome: "cancelled",
        failureCode: null,
        result: null,
      }),
    }));
  });
});
