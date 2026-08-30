import { describe, expect, it, vi } from "vitest";
import { runWorkerOnce } from "@/packages/worker-supervisor";
import { workerExecutionProfile, type WorkerTaskContract } from "@/packages/worker-contracts";
import { RUNTIME_OBSERVATION_MAX_BUDGET } from "@/packages/runtime-observer";

const task: WorkerTaskContract = {
  taskId: "11111111-1111-4111-8111-111111111111",
  attemptId: "22222222-2222-4222-8222-222222222222",
  executionClass: "passive_runtime_observation_v1",
  leaseToken: "a".repeat(64),
  absoluteDeadlineAt: "2099-08-31T00:00:30.000Z",
  budget: workerExecutionProfile("passive_runtime_observation_v1").budget,
  input: {
    kind: "passive_runtime_observation",
    domainJobId: "33333333-3333-4333-8333-333333333333",
  },
};

const prepared = {
  taskId: task.taskId,
  attemptId: task.attemptId,
  executionClass: "passive_runtime_observation_v1" as const,
  domainJobId: task.input.kind === "passive_runtime_observation" ? task.input.domainJobId : "",
  expiresAt: "2099-08-31T00:00:25.000Z",
  target: {
    assetRef: "44444444-4444-4444-8444-444444444444" as never,
    kind: "web_application" as const,
    canonicalUrl: "https://example.com/",
    hostname: "example.com",
  },
  budget: RUNTIME_OBSERVATION_MAX_BUDGET,
};

const terminal = {
  schemaVersion: 1 as const,
  taskId: task.taskId,
  attemptId: task.attemptId,
  executionClass: "passive_runtime_observation_v1" as const,
  outcome: "succeeded" as const,
  failureCode: null,
  metrics: { wallTimeMs: 10, cpuTimeMs: 1, peakMemoryBytes: 1, inputBytes: 0, outputBytes: 100 },
  result: {
    kind: "passive_runtime_observation" as const,
    requestCount: 1,
    redirectCount: 0,
    observations: [{ kind: "http-status" as const, url: "https://example.com/", status: 200 }],
  },
};

describe("Phase 6D worker supervisor", () => {
  it("prepares with the lease but strips lease and target authority before executor dispatch", async () => {
    const cleanup = vi.fn(async () => undefined);
    const runtimePrepare = vi.fn(async () => prepared);
    const prepare = vi.fn(async () => ({
      contract: {
        taskId: task.taskId,
        attemptId: task.attemptId,
        executionClass: "passive_runtime_observation_v1" as const,
        absoluteDeadlineAt: task.absoluteDeadlineAt,
        budget: task.budget,
        input: {
          kind: "runtime_worker_prepared" as const,
          domainJobId: prepared.domainJobId,
          mediatorSocketPath: `/run/scopeforge/runtime-mediator/${"b".repeat(64)}.sock`,
          mediatorSession: {
            taskId: task.taskId,
            attemptId: task.attemptId,
            executionClass: "passive_runtime_observation_v1" as const,
            nonce: "c".repeat(64),
          },
        },
      },
      cleanup,
    }));
    const execute = vi.fn(async (contract) => {
      expect(contract).not.toHaveProperty("leaseToken");
      expect(JSON.stringify(contract)).not.toContain("https://example.com/");
      expect(JSON.stringify(contract)).not.toContain("hostname");
      expect(JSON.stringify(contract)).not.toContain("assetRef");
      return terminal;
    });
    const finalize = vi.fn();
    const runtimeFinalize = vi.fn(async () => ({ outcome: "succeeded" as const, replayed: false }));

    await runWorkerOnce({
      control: {
        claim: vi.fn(async () => task),
        runtimePrepare,
        runtimeFinalize,
        heartbeat: vi.fn(async () => ({ cancelRequested: false, leaseExpiresAt: "2099-08-31T00:00:20.000Z" })),
        finalize,
      },
      executor: { execute },
      runtimeNetworkPreparer: { prepare },
      heartbeatMs: 60_000,
    });

    expect(runtimePrepare).toHaveBeenCalledWith({
      taskId: task.taskId,
      attemptId: task.attemptId,
      leaseToken: task.leaseToken,
    });
    expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ task, prepared }));
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(runtimeFinalize).toHaveBeenCalledWith({
      taskId: task.taskId,
      attemptId: task.attemptId,
      leaseToken: task.leaseToken,
      terminal,
    });
    expect(finalize).not.toHaveBeenCalled();
  });
});
