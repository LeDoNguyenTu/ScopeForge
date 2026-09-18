import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  createWorkerControlRepository,
  type RuntimeWorkerControlRepository,
  type WorkerControlRepository,
} from "@/lib/worker-control/repository";
import {
  claimWorkerTaskForNode,
  registerActiveCorsWorkerNode,
  registerPhase11HttpWorkerNode,
  registerPassiveRuntimeWorkerNode,
} from "@/lib/worker-control/service";
import { workerExecutionProfile } from "@/packages/worker-contracts";

const workerId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const attemptId = "33333333-3333-4333-8333-333333333333";
const domainJobId = "44444444-4444-4444-8444-444444444444";
const leaseToken = "a".repeat(64);

function rpcClient(resultFor: (name: string) => unknown) {
  const rpc = vi.fn(async (name: string) => ({ data: resultFor(name), error: null }));
  return { client: { rpc } as never, rpc };
}

describe("Phase 6D worker control paths", () => {
  it("maps registration and enqueue to dedicated Phase 6D RPC names", async () => {
    const { client, rpc } = rpcClient((name) => {
      if (name === "register_passive_runtime_worker_node") {
        return { workerId, executionClass: "passive_runtime_observation_v1", softwareVersion: "0.1.0" };
      }
      if (name === "register_active_cors_worker_node") {
        return { workerId, executionClass: "active_cors_validation_v1", softwareVersion: "0.1.0" };
      }
      if (name === "enqueue_passive_runtime_worker_task") {
        return {
          scanJobId: domainJobId,
          taskId,
          executionClass: "passive_runtime_observation_v1",
          absoluteDeadlineAt: "2026-08-31T00:00:30.000Z",
        };
      }
      throw new Error(`unexpected rpc ${name}`);
    });
    const repository = createWorkerControlRepository(client);

    await repository.registerPassiveRuntime({ credentialHash: "b".repeat(64), softwareVersion: "0.1.0" });
    await repository.registerActiveCors({ credentialHash: "c".repeat(64), softwareVersion: "0.1.0" });
    await repository.enqueuePassiveRuntime({
      workspaceId: "55555555-5555-4555-8555-555555555555",
      scanJobId: domainJobId,
      actorId: "66666666-6666-4666-8666-666666666666",
    });

    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "register_passive_runtime_worker_node",
      "register_active_cors_worker_node",
      "enqueue_passive_runtime_worker_task",
    ]);
  });

  it("parses Phase 6D claims through a dedicated runtime parser", async () => {
    const { client } = rpcClient((name) => {
      if (name !== "claim_runtime_worker_task") throw new Error(`unexpected rpc ${name}`);
      return {
        taskId,
        attemptId,
        executionClass: "passive_runtime_observation_v1",
        leaseToken,
        leaseExpiresAt: "2026-08-31T00:00:30.000Z",
        absoluteDeadlineAt: "2026-08-31T00:00:30.000Z",
        budget: workerExecutionProfile("passive_runtime_observation_v1").budget,
        input: { kind: "passive_runtime_observation", domainJobId },
      };
    });
    const repository = createWorkerControlRepository(client);

    await expect(repository.claimRuntime({ workerId })).resolves.toEqual({
      taskId,
      attemptId,
      executionClass: "passive_runtime_observation_v1",
      leaseToken,
      absoluteDeadlineAt: "2026-08-31T00:00:30.000Z",
      budget: workerExecutionProfile("passive_runtime_observation_v1").budget,
      input: { kind: "passive_runtime_observation", domainJobId },
    });
  });

  it("registers runtime nodes through explicit service methods and routes runtime claims separately", async () => {
    const registerPassiveRuntime = vi.fn(async (input: { credentialHash: string; softwareVersion: string }) => ({
      workerId,
      executionClass: "passive_runtime_observation_v1" as const,
      softwareVersion: input.softwareVersion,
    }));
    const registerActiveCors = vi.fn(async (input: { credentialHash: string; softwareVersion: string }) => ({
      workerId,
      executionClass: "active_cors_validation_v1" as const,
      softwareVersion: input.softwareVersion,
    }));
    const claimRuntime = vi.fn(async () => ({
      taskId,
      attemptId,
      executionClass: "active_cors_validation_v1" as const,
      leaseToken,
      absoluteDeadlineAt: "2026-08-31T00:00:20.000Z",
      budget: workerExecutionProfile("active_cors_validation_v1").budget,
      input: { kind: "active_cors_validation" as const, domainJobId },
    }));
    const runtimeRepository = {
      registerPassiveRuntime,
      registerActiveCors,
      registerPhase11Http: vi.fn(),
      enqueuePassiveRuntime: vi.fn(),
      enqueueActiveCors: vi.fn(),
      claimRuntime,
      claimPhase11Http: vi.fn(),
    } as RuntimeWorkerControlRepository;
    const repository = {} as WorkerControlRepository;
    const randomBytes = () => Buffer.alloc(32, 7);

    const passive = await registerPassiveRuntimeWorkerNode(
      { softwareVersion: "0.1.0" },
      { repository, runtimeRepository, randomBytes },
    );
    const active = await registerActiveCorsWorkerNode(
      { softwareVersion: "0.1.0" },
      { repository, runtimeRepository, randomBytes },
    );

    const expectedHash = createHash("sha256").update(Buffer.alloc(32, 7).toString("hex"), "utf8").digest("hex");
    expect(registerPassiveRuntime).toHaveBeenCalledWith({ credentialHash: expectedHash, softwareVersion: "0.1.0" });
    expect(registerActiveCors).toHaveBeenCalledWith({ credentialHash: expectedHash, softwareVersion: "0.1.0" });
    expect(passive.executionClass).toBe("passive_runtime_observation_v1");
    expect(active.executionClass).toBe("active_cors_validation_v1");

    await expect(claimWorkerTaskForNode({
      workerId,
      executionClass: "active_cors_validation_v1",
      softwareVersion: "0.1.0",
    }, { repository, runtimeRepository })).resolves.toMatchObject({
      executionClass: "active_cors_validation_v1",
      input: { kind: "active_cors_validation", domainJobId },
    });
    expect(claimRuntime).toHaveBeenCalledWith({ workerId });
  });
});

describe("Phase 11 HTTP worker control paths", () => {
  it("maps registration and claim to the dedicated Phase 11 RPCs", async () => {
    const runId = "55555555-5555-4555-8555-555555555555";
    const actionId = `phase11-action:${"c".repeat(64)}`;
    const authorizationId = `phase11-authz:${"d".repeat(64)}`;
    const { client, rpc } = rpcClient((name) => {
      if (name === "register_phase11_http_worker_node") {
        return { workerId, executionClass: "phase11_http_discovery_v1", softwareVersion: "0.1.0" };
      }
      if (name === "claim_phase11_http_worker_task") {
        return {
          taskId,
          attemptId,
          executionClass: "phase11_http_discovery_v1",
          leaseToken,
          absoluteDeadlineAt: "2026-09-19T00:00:30.000Z",
          budget: workerExecutionProfile("phase11_http_discovery_v1").budget,
          input: { kind: "phase11_http_discovery", runId, actionId, authorizationId },
        };
      }
      throw new Error(`unexpected rpc ${name}`);
    });
    const repository = createWorkerControlRepository(client);

    await expect(repository.registerPhase11Http({
      credentialHash: "b".repeat(64),
      softwareVersion: "0.1.0",
    })).resolves.toMatchObject({ executionClass: "phase11_http_discovery_v1" });
    await expect(repository.claimPhase11Http({ workerId })).resolves.toMatchObject({
      executionClass: "phase11_http_discovery_v1",
      input: { kind: "phase11_http_discovery", runId, actionId, authorizationId },
    });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "register_phase11_http_worker_node",
      "claim_phase11_http_worker_task",
    ]);
  });

  it("routes an authenticated Phase 11 node only through its dedicated repository", async () => {
    const runId = "55555555-5555-4555-8555-555555555555";
    const actionId = `phase11-action:${"c".repeat(64)}`;
    const authorizationId = `phase11-authz:${"d".repeat(64)}`;
    const claimPhase11Http = vi.fn(async () => ({
      taskId,
      attemptId,
      executionClass: "phase11_http_discovery_v1" as const,
      leaseToken,
      absoluteDeadlineAt: "2026-09-19T00:00:30.000Z",
      budget: workerExecutionProfile("phase11_http_discovery_v1").budget,
      input: { kind: "phase11_http_discovery" as const, runId, actionId, authorizationId },
    }));
    const runtimeRepository = {
      registerPassiveRuntime: vi.fn(),
      registerActiveCors: vi.fn(),
      registerPhase11Http: vi.fn(async (input: { softwareVersion: string }) => ({
        workerId,
        executionClass: "phase11_http_discovery_v1" as const,
        softwareVersion: input.softwareVersion,
      })),
      enqueuePassiveRuntime: vi.fn(),
      enqueueActiveCors: vi.fn(),
      claimRuntime: vi.fn(),
      claimPhase11Http,
    } as RuntimeWorkerControlRepository;
    const repository = {} as WorkerControlRepository;

    await expect(claimWorkerTaskForNode({
      workerId,
      executionClass: "phase11_http_discovery_v1",
      softwareVersion: "0.1.0",
    }, { repository, runtimeRepository })).resolves.toMatchObject({
      executionClass: "phase11_http_discovery_v1",
      input: { kind: "phase11_http_discovery", authorizationId },
    });
    expect(claimPhase11Http).toHaveBeenCalledWith({ workerId });

    const randomBytes = () => Buffer.alloc(32, 7);
    await registerPhase11HttpWorkerNode(
      { softwareVersion: "0.1.0" },
      { repository, runtimeRepository, randomBytes },
    );
    expect(runtimeRepository.registerPhase11Http).toHaveBeenCalled();
  });
});
