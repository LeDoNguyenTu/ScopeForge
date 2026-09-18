import { describe, expect, it, vi } from "vitest";
import { createPhase11HttpWorkerQueueAdapter } from "@/lib/phase11-http-worker/queue";
import type { Phase11HttpWorkerQueueRepository } from "@/lib/phase11-http-worker/queue";
import type { QueueApprovedActionInput } from "@/lib/pentest-runs/types";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const runId = "22222222-2222-4222-8222-222222222222";
const taskId = "33333333-3333-4333-8333-333333333333";
const actionId = "phase11-action:" + "a".repeat(64);
const authorizationId = "phase11-authz:" + "b".repeat(64);
const targetNodeId = "target-node-1";

function input(): QueueApprovedActionInput {
  return {
    workspaceId,
    runId,
    idempotencyKey: authorizationId,
    intent: {
      actionId,
      hypothesisId: "hypothesis-1",
      capabilityId: "web.http.probe.v1",
      targetNodeIds: [targetNodeId],
      requestedMode: "safe_active",
      closedParameters: {
        discoveryProfile: "root-only",
        methodProfile: "GET_ONLY",
        followSameOriginRedirects: false,
      },
      expectedEvidenceTypes: ["http-response"],
    },
    authorization: {
      authorizationId,
      actionId,
      workspaceId,
      targetNodeIds: [targetNodeId],
      authorizationSnapshotRef: "snapshot-1",
      capabilityId: "web.http.probe.v1",
      capabilityVersion: "1.0.0",
      executionMode: "safe_active",
      maxRequests: 1,
      maxRuntimeMs: 5_000,
      expiresAt: "2099-01-01T00:00:00.000Z",
      cancellationKey: "phase11-cancel:" + "c".repeat(64),
    },
  };
}

function repository(): Phase11HttpWorkerQueueRepository {
  return {
    enqueue: vi.fn(async () => ({ taskId, replayed: false })),
    cancel: vi.fn(async () => ({ cancelled: true, replayed: false })),
  };
}

describe("Phase 11C HTTP worker queue adapter", () => {
  it("enqueues by exact Phase 11 identity only and returns an opaque queue reference", async () => {
    const repo = repository();
    const adapter = createPhase11HttpWorkerQueueAdapter(repo);

    await expect(adapter.enqueueApprovedAction(input())).resolves.toEqual({
      queueReference: `phase11-http-worker:${taskId}`,
    });
    expect(repo.enqueue).toHaveBeenCalledWith({
      workspaceId,
      runId,
      actionId,
      authorizationId,
    });
  });

  it("rejects identity, target, mode, version, parameter, and budget drift before persistence", async () => {
    const mutations: Array<(value: QueueApprovedActionInput) => void> = [
      (value) => { value.idempotencyKey = "phase11-authz:" + "d".repeat(64); },
      (value) => { value.authorization.capabilityVersion = "2.0.0"; },
      (value) => { value.authorization.executionMode = "validation"; },
      (value) => { value.intent.requestedMode = "validation"; },
      (value) => { value.authorization.targetNodeIds = ["other-node"]; },
      (value) => { value.intent.closedParameters = { ...value.intent.closedParameters, url: "https://attacker.invalid" }; },
      (value) => { value.authorization.maxRequests = 0; },
      (value) => { value.authorization.maxRuntimeMs = 31_000; },
    ];

    for (const mutate of mutations) {
      const value = input();
      mutate(value);
      const repo = repository();
      await expect(createPhase11HttpWorkerQueueAdapter(repo).enqueueApprovedAction(value)).rejects.toThrow();
      expect(repo.enqueue).not.toHaveBeenCalled();
    }
  });

  it("requires enough authorization budget for the exact closed profile", async () => {
    const value = input();
    value.intent.capabilityId = "web.route.discover.v1";
    value.authorization.capabilityId = "web.route.discover.v1";
    value.intent.closedParameters = {
      discoveryProfile: "well-known-safe",
      methodProfile: "HEAD_THEN_GET",
      followSameOriginRedirects: true,
    };
    value.authorization.maxRequests = 11;

    await expect(createPhase11HttpWorkerQueueAdapter(repository()).enqueueApprovedAction(value))
      .rejects.toThrow("PHASE11_HTTP_QUEUE_BUDGET_INVALID");
  });

  it("cancels only opaque queue references bound to the same run/action", async () => {
    const repo = repository();
    const adapter = createPhase11HttpWorkerQueueAdapter(repo);
    await adapter.cancelQueuedAction({
      workspaceId,
      runId,
      actionId,
      queueReference: `phase11-http-worker:${taskId}`,
    });
    expect(repo.cancel).toHaveBeenCalledWith({
      workspaceId,
      runId,
      actionId,
      taskId,
    });
  });

  it("rejects foreign queue-reference schemes before cancellation persistence", async () => {
    const repo = repository();
    const adapter = createPhase11HttpWorkerQueueAdapter(repo);
    await expect(adapter.cancelQueuedAction({
      workspaceId,
      runId,
      actionId,
      queueReference: taskId,
    })).rejects.toThrow("PHASE11_HTTP_QUEUE_REFERENCE_INVALID");
    expect(repo.cancel).not.toHaveBeenCalled();
  });
});
