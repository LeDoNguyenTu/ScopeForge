import { describe, expect, it, vi } from "vitest";
import { createPhase11HttpWorkerPreparationContextRepository } from "./preparation-context";

const workerId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const attemptId = "33333333-3333-4333-8333-333333333333";
const workspaceId = "44444444-4444-4444-8444-444444444444";
const runId = "55555555-5555-4555-8555-555555555555";
const actionId = `phase11-action:${"a".repeat(64)}`;
const authorizationId = `phase11-authz:${"b".repeat(64)}`;

function state() {
  return {
    binding: {
      taskId, workspaceId, runId, actionId, authorizationId,
      authorizationSnapshotRef: "snapshot:1", targetNodeId: "node:1",
      capabilityId: "web.route.discover.v1", capabilityVersion: "1.0.0",
      providerId: "scopeforge.http-discovery", providerVersion: "1.0.0",
    },
    run: { status: "running", authorizationSnapshotRef: "snapshot:1" },
    snapshot: {
      snapshotRef: "snapshot:1", authorizedNodeIds: ["node:1"],
      expiresAt: "2026-09-19T01:00:00.000Z",
    },
    action: {
      state: "running", decisionStatus: "approved", authorizationId,
      authorizationSnapshotRef: "snapshot:1", capabilityId: "web.route.discover.v1",
      capabilityVersion: "1.0.0", targetNodeIds: ["node:1"], requestedMode: "safe_active",
      closedParameters: {
        discoveryProfile: "well-known-safe", methodProfile: "GET_ONLY",
        followSameOriginRedirects: false,
      },
      maxRequests: 4, maxRuntimeMs: 15000,
      authorizationExpiresAt: "2026-09-19T00:30:00.000Z",
    },
    targetNode: {
      nodeId: "node:1", assetType: "hostname", canonicalLocator: "https://example.com/",
      authorizationRef: "snapshot:1",
    },
  };
}

describe("Phase 11 HTTP lease-bound preparation context", () => {
  it("calls only the dedicated RPC and parses the exact authoritative shape", async () => {
    const rpc = vi.fn(async () => ({ data: state(), error: null }));
    const repository = createPhase11HttpWorkerPreparationContextRepository({ rpc } as never);
    await expect(repository.getPreparationContext({
      workerId, taskId, attemptId, leaseToken: "c".repeat(64),
    })).resolves.toMatchObject({
      binding: { taskId, workspaceId, runId, actionId, authorizationId },
      targetNode: { canonicalLocator: "https://example.com/" },
    });
    expect(rpc).toHaveBeenCalledWith("get_phase11_http_worker_preparation_context", {
      target_worker_id: workerId,
      target_task_id: taskId,
      target_attempt_id: attemptId,
      target_lease_token: "c".repeat(64),
    });
  });

  it("fails closed on extra fields or a mismatched task binding", async () => {
    const extra = state() as ReturnType<typeof state> & { url?: string };
    extra.url = "https://attacker.example/";
    const extraRepository = createPhase11HttpWorkerPreparationContextRepository({
      rpc: vi.fn(async () => ({ data: extra, error: null })),
    } as never);
    await expect(extraRepository.getPreparationContext({
      workerId, taskId, attemptId, leaseToken: "c".repeat(64),
    })).rejects.toMatchObject({ code: "RUNTIME_WORKER_TASK_INVALID" });

    const mismatched = state();
    mismatched.binding.taskId = "66666666-6666-4666-8666-666666666666";
    const mismatchRepository = createPhase11HttpWorkerPreparationContextRepository({
      rpc: vi.fn(async () => ({ data: mismatched, error: null })),
    } as never);
    await expect(mismatchRepository.getPreparationContext({
      workerId, taskId, attemptId, leaseToken: "c".repeat(64),
    })).rejects.toMatchObject({ code: "RUNTIME_WORKER_TASK_INVALID" });
  });
});
