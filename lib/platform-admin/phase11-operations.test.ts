import { describe, expect, it, vi } from "vitest";
import type { PentestRunRepository } from "@/lib/pentest-runs/types";
import { launchPhase11HttpCanary } from "./phase11-operations";

const NOW = new Date("2026-09-20T00:00:00.000Z");

describe("platform-admin Phase 11 operations", () => {
  it("launches one bounded verified-asset canary through planner, policy, and queue", async () => {
    let persistedHypotheses: Awaited<ReturnType<PentestRunRepository["loadPlanningState"]>>["hypotheses"] = [];
    const repository: PentestRunRepository = {
      createRun: vi.fn(async (input) => ({
        runId: input.runId,
        authorizationSnapshotRef: input.authorizationSnapshotRef,
        replayed: false,
      })),
      loadPlanningState: vi.fn(async (workspaceId, runId, snapshotRef) => ({
        run: {
          runId,
          workspaceId,
          rootAssetId: "11111111-1111-4111-8111-111111111111",
          authorizationSnapshotRef: snapshotRef,
          policySnapshot: {
            planner: { maxActionsPerIteration: 1, capabilityWeights: {}, capabilityReliability: { "web.http.probe.v1": 1 } },
            workspace: { maxExecutionMode: "safe_active" as const, maxRequestsPerAction: 1, maxRuntimeMsPerAction: 5_000, authorizationTtlMs: 300_000, labWorkspace: false },
            limits: { requestBudget: 1, graphExpansionLimit: 1, providerFailureLimit: 1 },
          },
          status: "created" as const,
        },
        snapshot: { snapshotRef, workspaceId, authorizedNodeIds: ["asset:11111111-1111-4111-8111-111111111111"], maxExecutionMode: "safe_active" as const, expiresAt: "2026-09-20T00:05:00.000Z" },
        graph: {
          nodes: [{
            assetNodeId: "asset:11111111-1111-4111-8111-111111111111",
            assetType: "http_service" as const,
            canonicalLocator: "https://scopeforge.dev/",
            parentNodeIds: [],
            authorizationRef: snapshotRef,
            technologyTags: [],
            confidence: 1,
            provenanceRefs: ["asset:verified"],
          }],
          edges: [],
        },
        observations: [],
        hypotheses: persistedHypotheses,
        coverage: { attemptedCapabilityIds: [], coveredNodeIds: [], untestedNodeIds: ["asset:11111111-1111-4111-8111-111111111111"], requestCount: 0, graphExpansionCount: 0, providerFailureCount: 0, startedAt: NOW.toISOString(), deadlineAt: "2026-09-20T00:00:30.000Z" },
        approvals: [],
      })),
      persistActionDecision: vi.fn(async (input) => ({ actionId: input.intent.actionId, state: "approved", shouldEnqueue: true, replayed: false, enqueueToken: "enqueue-token" })),
      markActionQueued: vi.fn(async (input) => ({ actionId: input.actionId, replayed: false, cancelled: false })),
      releaseActionEnqueue: vi.fn(async () => undefined),
      approveAction: vi.fn(),
      cancelRun: vi.fn(),
      stopRun: vi.fn(async () => undefined),
    };
    const persistGraph = vi.fn(async (input) => {
      persistedHypotheses = input.hypotheses;
      return { nodeCount: 1, edgeCount: 0, hypothesisCount: 1, eventCount: 0 };
    });
    const enqueueApprovedAction = vi.fn(async (input) => {
      expect(input.intent.closedParameters).toEqual({
        discoveryProfile: "root-only",
        methodProfile: "GET_ONLY",
        followSameOriginRedirects: false,
      });
      expect(input.authorization).toMatchObject({ maxRequests: 1, maxRuntimeMs: 5_000, executionMode: "safe_active" });
      return { queueReference: "phase11-http-worker:22222222-2222-4222-8222-222222222222" };
    });
    const writeAuditEvent = vi.fn(async () => undefined);

    const result = await launchPhase11HttpCanary({ assetId: "11111111-1111-4111-8111-111111111111" }, {
      authorize: vi.fn(async () => ({ actorId: "33333333-3333-4333-8333-333333333333" })),
      loadEligibleAsset: vi.fn(async () => ({
        id: "11111111-1111-4111-8111-111111111111",
        workspaceId: "44444444-4444-4444-8444-444444444444",
        kind: "web_application" as const,
        name: "ScopeForge",
        canonicalTarget: "https://scopeforge.dev/",
        verifiedAt: "2026-09-19T00:00:00.000Z",
        role: "owner" as const,
      })),
      repository,
      persistGraph,
      enqueueApprovedAction,
      cancelQueuedAction: vi.fn(async () => undefined),
      writeAuditEvent,
      now: () => NOW,
      createId: () => "55555555-5555-4555-8555-555555555555",
    });

    expect(result.runId).toBe("55555555-5555-4555-8555-555555555555");
    expect(result.queuedActionIds).toHaveLength(1);
    expect(persistGraph).toHaveBeenCalledWith(expect.objectContaining({
      hypotheses: [expect.objectContaining({ candidateCapabilityIds: ["web.http.probe.v1"], status: "eligible" })],
    }));
    expect(enqueueApprovedAction).toHaveBeenCalledTimes(1);
    expect(writeAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: "phase11.canary_queued",
      targetWorkspaceId: "44444444-4444-4444-8444-444444444444",
    }));
  });

  it("fails closed when the selected asset is not an actor-owned/administered verified web target", async () => {
    await expect(launchPhase11HttpCanary({ assetId: "11111111-1111-4111-8111-111111111111" }, {
      authorize: vi.fn(async () => ({ actorId: "33333333-3333-4333-8333-333333333333" })),
      loadEligibleAsset: vi.fn(async () => null),
      repository: {} as PentestRunRepository,
      persistGraph: vi.fn(),
      enqueueApprovedAction: vi.fn(),
      cancelQueuedAction: vi.fn(),
      writeAuditEvent: vi.fn(),
      now: () => NOW,
      createId: vi.fn(),
    })).rejects.toMatchObject({ code: "PHASE11_CANARY_ASSET_NOT_AUTHORIZED" });
  });
});
