import { describe, expect, it, vi } from "vitest";
import { publishRuntimeWorkerTerminal } from "@/lib/runtime-workers/publication";
import type { RuntimeWorkerPublicationDependencies } from "@/lib/runtime-workers/publication";

const workerId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const attemptId = "33333333-3333-4333-8333-333333333333";
const domainJobId = "44444444-4444-4444-8444-444444444444";
const workspaceId = "55555555-5555-4555-8555-555555555555";
const assetId = "66666666-6666-4666-8666-666666666666";
const leaseToken = "a".repeat(64);

const metrics = {
  wallTimeMs: 10,
  cpuTimeMs: 0,
  peakMemoryBytes: 0,
  inputBytes: 0,
  outputBytes: 64,
};

function dependencies(): RuntimeWorkerPublicationDependencies {
  return {
    getContext: vi.fn(async () => ({
      taskId,
      attemptId,
      executionClass: "passive_runtime_observation_v1" as const,
      domainJobId,
      workspaceId,
      assetId,
      cancelRequested: false,
      leaseExpiresAt: "2026-08-31T01:00:30.000Z",
      finishedAt: null,
      priorOutcome: null,
      priorTerminalDigest: null,
    })),
    loadPassiveJob: vi.fn(async () => null),
    loadActiveJob: vi.fn(async () => null),
    persistPassive: vi.fn(async () => undefined),
    persistActive: vi.fn(async () => undefined),
    finalize: vi.fn(async (input) => ({ outcome: input.outcome, replayed: false })),
  };
}

const identity = { workerId, taskId, attemptId, leaseToken };

describe("Phase 6D non-success terminal publication", () => {
  it("finalizes a failed worker report without loading or persisting domain observations", async () => {
    const deps = dependencies();
    const result = await publishRuntimeWorkerTerminal({
      ...identity,
      terminal: {
        schemaVersion: 1,
        taskId,
        attemptId,
        executionClass: "passive_runtime_observation_v1",
        outcome: "failed",
        failureCode: "PASSIVE_RUNTIME_NETWORK_ERROR",
        metrics,
        result: null,
      },
    }, deps);

    expect(deps.loadPassiveJob).not.toHaveBeenCalled();
    expect(deps.loadActiveJob).not.toHaveBeenCalled();
    expect(deps.persistPassive).not.toHaveBeenCalled();
    expect(deps.persistActive).not.toHaveBeenCalled();
    expect(deps.finalize).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "failed",
      failureCode: "PASSIVE_RUNTIME_NETWORK_ERROR",
      requestCount: 0,
      redirectCount: 0,
      findingCount: 0,
    }));
    expect(result).toEqual({ outcome: "failed", replayed: false });
  });

  it("finalizes a worker cancellation without loading or persisting domain observations", async () => {
    const deps = dependencies();
    const result = await publishRuntimeWorkerTerminal({
      ...identity,
      terminal: {
        schemaVersion: 1,
        taskId,
        attemptId,
        executionClass: "passive_runtime_observation_v1",
        outcome: "cancelled",
        failureCode: null,
        metrics,
        result: null,
      },
    }, deps);

    expect(deps.loadPassiveJob).not.toHaveBeenCalled();
    expect(deps.loadActiveJob).not.toHaveBeenCalled();
    expect(deps.persistPassive).not.toHaveBeenCalled();
    expect(deps.persistActive).not.toHaveBeenCalled();
    expect(deps.finalize).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "cancelled",
      failureCode: null,
      requestCount: 0,
      redirectCount: 0,
      findingCount: 0,
    }));
    expect(result).toEqual({ outcome: "cancelled", replayed: false });
  });
});
