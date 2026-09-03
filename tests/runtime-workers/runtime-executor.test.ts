import { describe, expect, it, vi } from "vitest";
import { createRuntimeWorkerExecutor } from "@/packages/worker-supervisor/runtime-network";
import { workerExecutionProfile } from "@/packages/worker-contracts";

const taskId = "11111111-1111-4111-8111-111111111111";
const attemptId = "22222222-2222-4222-8222-222222222222";
const domainJobId = "33333333-3333-4333-8333-333333333333";
const mediatorSocketPath = `/run/scopeforge/runtime-mediator/${"b".repeat(64)}.sock`;
const mediatorSession = {
  taskId,
  attemptId,
  executionClass: "passive_runtime_observation_v1" as const,
  nonce: "c".repeat(64),
};

const contract = {
  taskId,
  attemptId,
  executionClass: "passive_runtime_observation_v1" as const,
  absoluteDeadlineAt: "2099-08-31T00:00:30.000Z",
  budget: workerExecutionProfile("passive_runtime_observation_v1").budget,
  input: {
    kind: "runtime_worker_prepared" as const,
    domainJobId,
    mediatorSocketPath,
    mediatorSession,
  },
};

const successWire = {
  status: "succeeded",
  result: {
    kind: "passive_runtime_observation",
    requestCount: 1,
    redirectCount: 0,
    observations: [{ kind: "http-status", url: "https://example.com/", status: 200 }],
  },
};

describe("Phase 6D runtime container executor", () => {
  it("passes only the opaque mediator identity into the networkless sandbox and emits a validated terminal", async () => {
    const execute = vi.fn(async () => ({ output: JSON.stringify(successWire) }));
    const executor = createRuntimeWorkerExecutor({
      podmanBinary: "/usr/bin/podman",
      runtimeImage: `ghcr.io/scopeforge/runtime-worker@sha256:${"a".repeat(64)}`,
      sandbox: { execute },
      now: (() => {
        let value = 10;
        return () => value += 5;
      })(),
    });

    const terminal = await executor.execute(contract, new AbortController().signal);

    expect(execute).toHaveBeenCalledWith({
      podmanBinary: "/usr/bin/podman",
      image: `ghcr.io/scopeforge/runtime-worker@sha256:${"a".repeat(64)}`,
      taskId,
      attemptId,
      executionClass: "passive_runtime_observation_v1",
      mediatorSessionNonce: mediatorSession.nonce,
      mediatorSocketPath,
    }, expect.any(AbortSignal));
    expect(terminal).toMatchObject({
      taskId,
      attemptId,
      executionClass: "passive_runtime_observation_v1",
      outcome: "succeeded",
      failureCode: null,
      result: successWire.result,
    });
    expect(JSON.stringify(terminal)).not.toContain(mediatorSession.nonce);
    expect(JSON.stringify(terminal)).not.toContain(mediatorSocketPath);
  });

  it("preserves mediator cancellation as a cancelled terminal without a worker failure code", async () => {
    const executor = createRuntimeWorkerExecutor({
      podmanBinary: "/usr/bin/podman",
      runtimeImage: `ghcr.io/scopeforge/runtime-worker@sha256:${"a".repeat(64)}`,
      sandbox: {
        execute: vi.fn(async () => ({
          output: JSON.stringify({ status: "cancelled", requestCount: 1, redirectCount: 0 }),
        })),
      },
      now: () => 10,
    });

    await expect(executor.execute(contract, new AbortController().signal)).resolves.toMatchObject({
      outcome: "cancelled",
      failureCode: null,
      result: null,
    });
  });

  it("maps malformed container output to the closed output-invalid terminal", async () => {
    const executor = createRuntimeWorkerExecutor({
      podmanBinary: "/usr/bin/podman",
      runtimeImage: `ghcr.io/scopeforge/runtime-worker@sha256:${"a".repeat(64)}`,
      sandbox: { execute: vi.fn(async () => ({ output: "not-json" })) },
      now: () => 10,
    });

    await expect(executor.execute(contract, new AbortController().signal)).resolves.toMatchObject({
      outcome: "failed",
      failureCode: "RUNTIME_WORKER_OUTPUT_INVALID",
      result: null,
    });
  });

  it("maps sandbox failure to a closed execution code without surfacing the exception", async () => {
    const executor = createRuntimeWorkerExecutor({
      podmanBinary: "/usr/bin/podman",
      runtimeImage: `ghcr.io/scopeforge/runtime-worker@sha256:${"a".repeat(64)}`,
      sandbox: { execute: vi.fn(async () => { throw new Error("podman secret detail"); }) },
      now: () => 10,
    });

    const terminal = await executor.execute(contract, new AbortController().signal);
    expect(terminal).toMatchObject({
      outcome: "failed",
      failureCode: "RUNTIME_WORKER_EXECUTION_FAILED",
      result: null,
    });
    expect(JSON.stringify(terminal)).not.toContain("podman secret detail");
  });
});
