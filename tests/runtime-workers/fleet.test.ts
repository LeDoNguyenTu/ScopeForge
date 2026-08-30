import { describe, expect, it, vi } from "vitest";
import { createWorkerControlRepository } from "@/lib/worker-control/repository";

function baseSnapshot() {
  return {
    generatedAt: "2026-08-31T02:00:00.000Z",
    nodes: [],
    taskCounts: {
      queued: 0,
      leased: 1,
      retryWait: 0,
      completed: 0,
      deadLetter: 0,
      cancelled: 0,
    },
    activeLeaseCount: 1,
    runtimeClasses: {
      passiveRuntime: {
        executionClass: "passive_runtime_observation_v1",
        enabledNodeCount: 2,
        leasedCount: 1,
        capacity: 2,
        available: true,
        saturated: false,
      },
      activeCors: {
        executionClass: "active_cors_validation_v1",
        enabledNodeCount: 1,
        leasedCount: 1,
        capacity: 1,
        available: false,
        saturated: true,
      },
    },
  };
}

function clientFor(data: unknown) {
  return {
    rpc: vi.fn(async (name: string) => {
      expect(name).toBe("get_worker_fleet_snapshot");
      return { data, error: null };
    }),
  } as never;
}

describe("Phase 6D runtime fleet health", () => {
  it("exposes only bounded class-level availability and saturation data", async () => {
    const repository = createWorkerControlRepository(clientFor(baseSnapshot()));
    const snapshot = await repository.fleetSnapshot();

    expect(snapshot.runtimeClasses).toEqual({
      passiveRuntime: {
        executionClass: "passive_runtime_observation_v1",
        enabledNodeCount: 2,
        leasedCount: 1,
        capacity: 2,
        available: true,
        saturated: false,
      },
      activeCors: {
        executionClass: "active_cors_validation_v1",
        enabledNodeCount: 1,
        leasedCount: 1,
        capacity: 1,
        available: false,
        saturated: true,
      },
    });
    expect(JSON.stringify(snapshot.runtimeClasses)).not.toMatch(/target|url|host|header|body|cookie|response|resolver|exception/i);
  });

  it("treats the fleet-wide lease ceiling as saturation for both runtime classes", async () => {
    const data = baseSnapshot();
    data.activeLeaseCount = 4;
    data.runtimeClasses.passiveRuntime.available = false;
    data.runtimeClasses.passiveRuntime.saturated = true;
    data.runtimeClasses.activeCors.available = false;
    data.runtimeClasses.activeCors.saturated = true;

    const repository = createWorkerControlRepository(clientFor(data));
    const snapshot = await repository.fleetSnapshot();

    expect(snapshot.runtimeClasses.passiveRuntime).toMatchObject({
      available: false,
      saturated: true,
    });
    expect(snapshot.runtimeClasses.activeCors).toMatchObject({
      available: false,
      saturated: true,
    });
  });

  it("rejects unexpected data smuggled into the runtime fleet summary", async () => {
    const unsafe = baseSnapshot();
    const data = {
      ...unsafe,
      runtimeClasses: {
        ...unsafe.runtimeClasses,
        passiveRuntime: {
          ...unsafe.runtimeClasses.passiveRuntime,
          targetUrl: "https://example.com/secret",
        },
      },
    };
    const repository = createWorkerControlRepository(clientFor(data));

    await expect(repository.fleetSnapshot()).rejects.toMatchObject({
      code: "WORKER_CONTROL_FAILED",
    });
  });
});
