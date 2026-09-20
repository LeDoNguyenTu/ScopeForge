import { describe, expect, it, vi } from "vitest";
import { preparePhase11HttpWorker } from "@/lib/phase11-http-worker/preparation";
import type {
  Phase11HttpWorkerAuthoritativeState,
  Phase11HttpWorkerStateRepository,
} from "@/lib/phase11-http-worker/types";

const NOW = new Date("2026-09-19T00:00:00.000Z");
const taskId = "11111111-1111-4111-8111-111111111111";
const workspaceId = "22222222-2222-4222-8222-222222222222";
const runId = "33333333-3333-4333-8333-333333333333";
const actionId = "phase11-action:" + "a".repeat(64);
const authorizationId = "phase11-authz:" + "b".repeat(64);
const snapshotRef = "phase11-auth:fixture-run";
const targetNodeId = "target-node-1";

function authoritativeState(): Phase11HttpWorkerAuthoritativeState {
  return {
    binding: {
      taskId,
      workspaceId,
      runId,
      actionId,
      authorizationId,
      authorizationSnapshotRef: snapshotRef,
      targetNodeId,
      capabilityId: "web.route.discover.v1",
      capabilityVersion: "1.0.0",
      providerId: "scopeforge.http-discovery",
      providerVersion: "1.0.0",
    },
    run: {
      status: "running",
      authorizationSnapshotRef: snapshotRef,
    },
    snapshot: {
      snapshotRef,
      authorizedNodeIds: [targetNodeId],
      expiresAt: "2026-09-19T00:05:00.000Z",
    },
    action: {
      state: "running",
      decisionStatus: "approved",
      authorizationId,
      authorizationSnapshotRef: snapshotRef,
      capabilityId: "web.route.discover.v1",
      capabilityVersion: "1.0.0",
      targetNodeIds: [targetNodeId],
      requestedMode: "safe_active",
      closedParameters: {
        discoveryProfile: "well-known-safe",
        methodProfile: "GET_ONLY",
        followSameOriginRedirects: false,
      },
      maxRequests: 4,
      maxRuntimeMs: 15_000,
      authorizationExpiresAt: "2026-09-19T00:03:00.000Z",
    },
    targetNode: {
      nodeId: targetNodeId,
      assetType: "http_service",
      canonicalLocator: "https://example.com/",
      authorizationRef: snapshotRef,
    },
  };
}

function repository(state = authoritativeState()): Phase11HttpWorkerStateRepository {
  return {
    loadAuthoritativeState: vi.fn(async () => state),
  };
}

const input = { taskId, workspaceId, runId, actionId, authorizationId };

describe("Phase 11C trusted HTTP worker preparation", () => {
  it("derives the mediator profile only from authoritative Phase 11 state", async () => {
    const repo = repository();
    const prepared = await preparePhase11HttpWorker(input, {
      repository: repo,
      now: () => NOW,
    });

    expect(repo.loadAuthoritativeState).toHaveBeenCalledWith(input);
    expect(prepared).toEqual({
      taskId,
      workspaceId,
      runId,
      actionId,
      authorizationId,
      authorizationSnapshotRef: snapshotRef,
      targetNodeId,
      target: {
        assetRef: targetNodeId,
        kind: "web_application",
        canonicalUrl: "https://example.com/",
        hostname: "example.com",
      },
      capabilityId: "web.route.discover.v1",
      discoveryProfile: "well-known-safe",
      methodProfile: "GET_ONLY",
      followSameOriginRedirects: false,
      budget: {
        maxRequests: 4,
        perRequestTimeoutMs: 5_000,
        totalTimeoutMs: 15_000,
      },
      expiresAt: "2026-09-19T00:03:00.000Z",
    });
  });

  it("accepts leased and pre-lease states but rejects state, decision, and execution-mode drift", async () => {
    for (const state of ["enqueueing", "queued"] as const) {
      await expect(preparePhase11HttpWorker(input, {
        repository: repository({
          ...authoritativeState(),
          action: { ...authoritativeState().action, state },
        }),
        now: () => NOW,
      })).resolves.toMatchObject({ actionId });
    }

    for (const actionPatch of [
      { state: "authorized" as const },
      { decisionStatus: "approval_required" as const },
      { requestedMode: "validation" as const },
    ]) {
      await expect(preparePhase11HttpWorker(input, {
        repository: repository({
          ...authoritativeState(),
          action: { ...authoritativeState().action, ...actionPatch },
        }),
        now: () => NOW,
      })).rejects.toThrow();
    }
  });

  it("rejects expired or drifted immutable authorization scope", async () => {
    const cases: Phase11HttpWorkerAuthoritativeState[] = [
      {
        ...authoritativeState(),
        snapshot: { ...authoritativeState().snapshot, expiresAt: "2026-09-18T23:59:59.000Z" },
      },
      {
        ...authoritativeState(),
        action: { ...authoritativeState().action, authorizationExpiresAt: "2026-09-18T23:59:59.000Z" },
      },
      {
        ...authoritativeState(),
        action: { ...authoritativeState().action, authorizationId: "phase11-authz:" + "c".repeat(64) },
      },
      {
        ...authoritativeState(),
        snapshot: { ...authoritativeState().snapshot, authorizedNodeIds: ["other-node"] },
      },
      {
        ...authoritativeState(),
        targetNode: { ...authoritativeState().targetNode, authorizationRef: "other-snapshot" },
      },
    ];

    for (const state of cases) {
      await expect(preparePhase11HttpWorker(input, {
        repository: repository(state),
        now: () => NOW,
      })).rejects.toThrow();
    }
  });

  it("rejects provider, capability, target, and binding identity drift", async () => {
    const cases: Phase11HttpWorkerAuthoritativeState[] = [
      {
        ...authoritativeState(),
        binding: { ...authoritativeState().binding, providerVersion: "9.9.9" as "1.0.0" },
      },
      {
        ...authoritativeState(),
        action: { ...authoritativeState().action, capabilityVersion: "2.0.0" },
      },
      {
        ...authoritativeState(),
        action: { ...authoritativeState().action, targetNodeIds: [targetNodeId, "other-node"] },
      },
      {
        ...authoritativeState(),
        binding: { ...authoritativeState().binding, actionId: "phase11-action:" + "d".repeat(64) },
      },
    ];

    for (const state of cases) {
      await expect(preparePhase11HttpWorker(input, {
        repository: repository(state),
        now: () => NOW,
      })).rejects.toThrow();
    }
  });

  it("rejects arbitrary or capability-incompatible HTTP parameters", async () => {
    const invalidParameters: Array<Record<string, string | number | boolean>> = [
      {
        discoveryProfile: "well-known-safe",
        methodProfile: "GET_ONLY",
        followSameOriginRedirects: false,
        url: "https://attacker.invalid",
      },
      {
        discoveryProfile: "unknown",
        methodProfile: "GET_ONLY",
        followSameOriginRedirects: false,
      },
    ];

    for (const closedParameters of invalidParameters) {
      await expect(preparePhase11HttpWorker(input, {
        repository: repository({
          ...authoritativeState(),
          action: { ...authoritativeState().action, closedParameters },
        }),
        now: () => NOW,
      })).rejects.toThrow();
    }

    const probeState = authoritativeState();
    probeState.binding.capabilityId = "web.http.probe.v1";
    probeState.action.capabilityId = "web.http.probe.v1";
    await expect(preparePhase11HttpWorker(input, {
      repository: repository(probeState),
      now: () => NOW,
    })).rejects.toThrow("PHASE11_HTTP_DISCOVERY_PROFILE_INVALID");
  });

  it("rejects insufficient request/runtime budgets before mediator execution", async () => {
    await expect(preparePhase11HttpWorker(input, {
      repository: repository({
        ...authoritativeState(),
        action: { ...authoritativeState().action, maxRequests: 3 },
      }),
      now: () => NOW,
    })).rejects.toThrow("PHASE11_HTTP_REQUEST_BUDGET_INSUFFICIENT");

    await expect(preparePhase11HttpWorker(input, {
      repository: repository({
        ...authoritativeState(),
        action: { ...authoritativeState().action, maxRuntimeMs: 0 },
      }),
      now: () => NOW,
    })).rejects.toThrow("PHASE11_HTTP_ACTION_BUDGET_INVALID");
  });

  it("requires a canonical public-facing HTTPS shape without caller URL authority", async () => {
    for (const canonicalLocator of [
      "http://example.com/",
      "https://example.com:8443/",
      "https://user:pass@example.com/",
      "https://example.com/?token=secret",
      "not-a-url",
    ]) {
      await expect(preparePhase11HttpWorker(input, {
        repository: repository({
          ...authoritativeState(),
          targetNode: { ...authoritativeState().targetNode, canonicalLocator },
        }),
        now: () => NOW,
      })).rejects.toThrow("PHASE11_HTTP_TARGET_URL_INVALID");
    }
  });
});
