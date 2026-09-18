import { describe, expect, it, vi } from "vitest";
import { createPhase11HttpWorkerQueueRepository } from "@/lib/phase11-http-worker/queue-repository";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const runId = "22222222-2222-4222-8222-222222222222";
const taskId = "33333333-3333-4333-8333-333333333333";
const actionId = "phase11-action:" + "a".repeat(64);
const authorizationId = "phase11-authz:" + "b".repeat(64);

describe("Phase 11 HTTP queue repository", () => {
  it("calls only the closed enqueue and cancel RPCs", async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === "enqueue_phase11_http_worker_task") {
        return { data: { taskId, replayed: false }, error: null };
      }
      if (name === "cancel_phase11_http_worker_task") {
        return { data: { cancelled: true, replayed: false }, error: null };
      }
      throw new Error("unexpected RPC");
    });
    const repository = createPhase11HttpWorkerQueueRepository({ rpc } as never);

    await expect(repository.enqueue({
      workspaceId,
      runId,
      actionId,
      authorizationId,
    })).resolves.toEqual({ taskId, replayed: false });

    await expect(repository.cancel({
      workspaceId,
      runId,
      actionId,
      taskId,
    })).resolves.toEqual({ cancelled: true, replayed: false });

    expect(rpc).toHaveBeenNthCalledWith(1, "enqueue_phase11_http_worker_task", {
      target_workspace_id: workspaceId,
      target_run_id: runId,
      target_action_id: actionId,
      target_authorization_id: authorizationId,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "cancel_phase11_http_worker_task", {
      target_workspace_id: workspaceId,
      target_run_id: runId,
      target_action_id: actionId,
      target_task_id: taskId,
    });
  });

  it("fails closed on malformed or failed RPC responses", async () => {
    const malformed = createPhase11HttpWorkerQueueRepository({
      rpc: vi.fn(async () => ({ data: { taskId, replayed: false, extra: true }, error: null })),
    } as never);
    await expect(malformed.enqueue({
      workspaceId, runId, actionId, authorizationId,
    })).rejects.toThrow("PHASE11_HTTP_QUEUE_PERSISTENCE_FAILED");

    const failed = createPhase11HttpWorkerQueueRepository({
      rpc: vi.fn(async () => ({ data: null, error: { message: "database detail" } })),
    } as never);
    await expect(failed.cancel({
      workspaceId, runId, actionId, taskId,
    })).rejects.toThrow("PHASE11_HTTP_QUEUE_CANCELLATION_FAILED");
  });
});
