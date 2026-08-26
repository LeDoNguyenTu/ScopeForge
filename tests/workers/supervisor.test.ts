import { describe, expect, it, vi } from "vitest";
import { runWorkerOnce } from "@/packages/worker-supervisor";
import type { WorkerTaskContract } from "@/packages/worker-contracts";

const task: WorkerTaskContract = {
  taskId: "33333333-3333-4333-8333-333333333333",
  attemptId: "44444444-4444-4444-8444-444444444444",
  executionClass: "foundation_no_egress_v1",
  leaseToken: "b".repeat(64),
  absoluteDeadlineAt: "2099-08-26T00:05:00.000Z",
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

function terminal(outcome: "succeeded" | "cancelled" = "succeeded") {
  return {
    schemaVersion: 1 as const,
    taskId: task.taskId,
    attemptId: task.attemptId,
    executionClass: "foundation_no_egress_v1" as const,
    outcome,
    failureCode: null,
    metrics: { wallTimeMs: 1, cpuTimeMs: 1, peakMemoryBytes: 1, inputBytes: 3, outputBytes: 64 },
    result: outcome === "succeeded" ? { kind: "foundation_probe" as const, nonceDigest: "a".repeat(64) } : null,
  };
}

describe("worker supervisor", () => {
  it("does not pass the lease token or broker credential into the executor", async () => {
    const execute = vi.fn(async (contract) => {
      expect(contract).not.toHaveProperty("leaseToken");
      expect(contract).not.toHaveProperty("credential");
      return terminal();
    });
    const finalize = vi.fn(async () => ({ outcome: "succeeded" as const, replayed: false }));

    await runWorkerOnce({
      control: {
        claim: vi.fn(async () => task),
        heartbeat: vi.fn(async () => ({ cancelRequested: false, leaseExpiresAt: "2099-08-26T00:01:30.000Z" })),
        finalize,
      },
      executor: { execute },
      heartbeatMs: 60_000,
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledWith({ leaseToken: task.leaseToken, terminal: terminal() });
  });

  it("aborts execution when a heartbeat reports cancellation", async () => {
    let aborted = false;
    const execute = vi.fn(async (_contract, signal: AbortSignal) => new Promise<ReturnType<typeof terminal>>((resolve) => {
      signal.addEventListener("abort", () => {
        aborted = true;
        resolve(terminal("cancelled"));
      }, { once: true });
    }));
    const finalize = vi.fn(async () => ({ outcome: "cancelled" as const, replayed: false }));

    await runWorkerOnce({
      control: {
        claim: vi.fn(async () => task),
        heartbeat: vi.fn(async () => ({ cancelRequested: true, leaseExpiresAt: "2099-08-26T00:01:30.000Z" })),
        finalize,
      },
      executor: { execute },
      heartbeatMs: 1,
    });

    expect(aborted).toBe(true);
    expect(finalize.mock.calls[0]?.[0].terminal.outcome).toBe("cancelled");
  });

  it("aborts after two consecutive control-channel heartbeat failures", async () => {
    const execute = vi.fn(async (_contract, signal: AbortSignal) => new Promise<ReturnType<typeof terminal>>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));
    const heartbeat = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"));
    const finalize = vi.fn(async () => ({ outcome: "failed" as const, replayed: false }));

    await runWorkerOnce({
      control: { claim: vi.fn(async () => task), heartbeat, finalize },
      executor: { execute },
      heartbeatMs: 1,
    });

    expect(heartbeat).toHaveBeenCalledTimes(2);
    expect(finalize.mock.calls[0]?.[0].terminal).toMatchObject({
      outcome: "failed",
      failureCode: "WORKER_LOST",
    });
  });

  it("enforces the outer wall-time budget independently of executor output", async () => {
    vi.useFakeTimers();
    try {
      const shortTask: WorkerTaskContract = {
        ...task,
        budget: { ...task.budget, maxWallTimeMs: 5 },
      };
      const execute = vi.fn(async (_contract, signal: AbortSignal) => new Promise<ReturnType<typeof terminal>>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("budget")), { once: true });
      }));
      const finalize = vi.fn(async () => ({ outcome: "failed" as const, replayed: false }));
      const run = runWorkerOnce({
        control: {
          claim: vi.fn(async () => shortTask),
          heartbeat: vi.fn(async () => ({ cancelRequested: false, leaseExpiresAt: "2099-08-26T00:01:30.000Z" })),
          finalize,
        },
        executor: { execute },
        heartbeatMs: 60_000,
      });

      await vi.advanceTimersByTimeAsync(6);
      await run;

      expect(finalize.mock.calls[0]?.[0].terminal).toMatchObject({
        outcome: "failed",
        failureCode: "WORKER_BUDGET_EXCEEDED",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops waiting at the outer deadline even when the executor ignores abort", async () => {
    vi.useFakeTimers();
    try {
      const shortTask: WorkerTaskContract = {
        ...task,
        budget: { ...task.budget, maxWallTimeMs: 5 },
      };
      const execute = vi.fn(async () => new Promise<ReturnType<typeof terminal>>(() => {}));
      const finalize = vi.fn(async () => ({ outcome: "failed" as const, replayed: false }));
      const run = runWorkerOnce({
        control: {
          claim: vi.fn(async () => shortTask),
          heartbeat: vi.fn(async () => ({ cancelRequested: false, leaseExpiresAt: "2099-08-26T00:01:30.000Z" })),
          finalize,
        },
        executor: { execute },
        heartbeatMs: 60_000,
      });

      await vi.advanceTimersByTimeAsync(6);
      await expect(run).resolves.toMatchObject({ status: "completed", outcome: "failed" });
      expect(finalize.mock.calls[0]?.[0].terminal).toMatchObject({
        outcome: "failed",
        failureCode: "WORKER_BUDGET_EXCEEDED",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns idle without invoking executor when no task is claimable", async () => {
    const execute = vi.fn();
    await expect(runWorkerOnce({
      control: {
        claim: vi.fn(async () => null),
        heartbeat: vi.fn(),
        finalize: vi.fn(),
      },
      executor: { execute },
    })).resolves.toEqual({ status: "idle" });
    expect(execute).not.toHaveBeenCalled();
  });
});
