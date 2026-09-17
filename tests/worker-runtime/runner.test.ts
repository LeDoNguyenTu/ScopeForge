import { describe, expect, it, vi } from "vitest";
import { runWorkerLoop } from "@/packages/worker-runtime/runner";

describe("worker runtime loop", () => {
  it("runs serially and stops after the current iteration", async () => {
    const controller = new AbortController();
    let active = 0;
    let peak = 0;
    const runOnce = vi.fn(async () => {
      active += 1;
      peak = Math.max(peak, active);
      active -= 1;
      controller.abort();
      return { status: "idle" as const };
    });

    await runWorkerLoop({ runOnce, signal: controller.signal, pollMs: 1 });
    expect(runOnce).toHaveBeenCalledTimes(1);
    expect(peak).toBe(1);
  });

  it("backs off after a bounded failure without logging exception details", async () => {
    const controller = new AbortController();
    const log = vi.fn();
    const runOnce = vi.fn(async () => {
      controller.abort();
      throw Object.assign(new Error("must-not-be-logged"), { code: "WORKER_DISABLED" });
    });

    await runWorkerLoop({ runOnce, signal: controller.signal, pollMs: 1, log });
    expect(log).toHaveBeenCalledWith({ event: "worker_iteration_failed", code: "WORKER_DISABLED" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("must-not-be-logged");
  });
});
