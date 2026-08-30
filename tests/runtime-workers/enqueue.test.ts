import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { enqueueRuntimeWorkerTask } from "@/lib/runtime-workers/enqueue";
import { RuntimeWorkerError } from "@/lib/runtime-workers/errors";

const passiveJob = Object.freeze({
  workspaceId: "11111111-1111-4111-8111-111111111111",
  scanJobId: "22222222-2222-4222-8222-222222222222",
  actorId: "33333333-3333-4333-8333-333333333333",
  jobKind: "passive_runtime" as const,
});

const activeJob = Object.freeze({
  ...passiveJob,
  scanJobId: "44444444-4444-4444-8444-444444444444",
  jobKind: "active_validation" as const,
});

function dependencies(capabilities = { passiveRuntime: true, activeCors: true }) {
  return {
    capabilities,
    workerControl: {
      enqueuePassiveRuntimeTask: vi.fn(async () => ({
        scanJobId: passiveJob.scanJobId,
        taskId: "55555555-5555-4555-8555-555555555555",
        executionClass: "passive_runtime_observation_v1" as const,
        absoluteDeadlineAt: "2026-08-31T00:00:30.000Z",
      })),
      enqueueActiveCorsTask: vi.fn(async () => ({
        scanJobId: activeJob.scanJobId,
        taskId: "66666666-6666-4666-8666-666666666666",
        executionClass: "active_cors_validation_v1" as const,
        absoluteDeadlineAt: "2026-08-31T00:00:20.000Z",
      })),
    },
  };
}

describe("Phase 6D runtime worker enqueue bridge", () => {
  it("fails before enqueue when the selected capability is disabled", async () => {
    const deps = dependencies({ passiveRuntime: false, activeCors: true });

    await expect(enqueueRuntimeWorkerTask({
      executionClass: "passive_runtime_observation_v1",
      domainJob: passiveJob,
    }, deps)).rejects.toMatchObject({ code: "RUNTIME_WORKER_UNAVAILABLE" });

    expect(deps.workerControl.enqueuePassiveRuntimeTask).not.toHaveBeenCalled();
    expect(deps.workerControl.enqueueActiveCorsTask).not.toHaveBeenCalled();
  });

  it("routes only the exact domain-job and execution-class pairing", async () => {
    const deps = dependencies();

    await expect(enqueueRuntimeWorkerTask({
      executionClass: "passive_runtime_observation_v1",
      domainJob: passiveJob,
    }, deps)).resolves.toMatchObject({ executionClass: "passive_runtime_observation_v1" });

    await expect(enqueueRuntimeWorkerTask({
      executionClass: "active_cors_validation_v1",
      domainJob: activeJob,
    }, deps)).resolves.toMatchObject({ executionClass: "active_cors_validation_v1" });

    expect(deps.workerControl.enqueuePassiveRuntimeTask).toHaveBeenCalledWith({
      workspaceId: passiveJob.workspaceId,
      scanJobId: passiveJob.scanJobId,
      actorId: passiveJob.actorId,
    });
    expect(deps.workerControl.enqueueActiveCorsTask).toHaveBeenCalledWith({
      workspaceId: activeJob.workspaceId,
      scanJobId: activeJob.scanJobId,
      actorId: activeJob.actorId,
    });
  });

  it("rejects a wrong job-kind/class pairing before the broker is called", async () => {
    const deps = dependencies();

    await expect(enqueueRuntimeWorkerTask({
      executionClass: "active_cors_validation_v1",
      domainJob: passiveJob,
    }, deps)).rejects.toBeInstanceOf(RuntimeWorkerError);

    await expect(enqueueRuntimeWorkerTask({
      executionClass: "active_cors_validation_v1",
      domainJob: passiveJob,
    }, deps)).rejects.toMatchObject({ code: "RUNTIME_WORKER_TASK_INVALID" });

    expect(deps.workerControl.enqueuePassiveRuntimeTask).not.toHaveBeenCalled();
    expect(deps.workerControl.enqueueActiveCorsTask).not.toHaveBeenCalled();
  });

  it("rejects caller-controlled request configuration instead of ignoring it", async () => {
    const deps = dependencies();
    const unsafe = {
      executionClass: "passive_runtime_observation_v1",
      domainJob: {
        ...passiveJob,
        canonicalUrl: "https://example.com/",
      },
    };

    await expect(enqueueRuntimeWorkerTask(unsafe as never, deps)).rejects.toMatchObject({
      code: "RUNTIME_WORKER_TASK_INVALID",
    });
    expect(deps.workerControl.enqueuePassiveRuntimeTask).not.toHaveBeenCalled();
  });

  it("maps broker workspace saturation to the safe busy error", async () => {
    const deps = dependencies();
    deps.workerControl.enqueuePassiveRuntimeTask.mockRejectedValueOnce(
      Object.assign(new Error("RUNTIME_WORKER_ACTIVE_LIMIT"), { code: "RUNTIME_WORKER_ACTIVE_LIMIT" }),
    );

    await expect(enqueueRuntimeWorkerTask({
      executionClass: "passive_runtime_observation_v1",
      domainJob: passiveJob,
    }, deps)).rejects.toMatchObject({ code: "RUNTIME_WORKER_BUSY" });
  });

  it("contains no direct runtime-network or fetch execution surface", async () => {
    const source = await readFile(path.resolve("lib/runtime-workers/enqueue.ts"), "utf8");
    expect(source).not.toMatch(/runtime-network/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/node:https|node:tls|node:dns/);
    expect(source).not.toMatch(/canonicalUrl|hostname|headers|\bbody\b|\bmethod\b/);
  });
});
