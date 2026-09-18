import { describe, expect, it, vi } from "vitest";
import { finalizeLeasedPhase11HttpWorker } from "./finalization";
import type { Phase11HttpWorkerFinalizationContext } from "./finalization-context";

const identity = Object.freeze({
  workerId: "11111111-1111-4111-8111-111111111111",
  taskId: "22222222-2222-4222-8222-222222222222",
  attemptId: "33333333-3333-4333-8333-333333333333",
  leaseToken: "a".repeat(64),
});
const actionId = `phase11-action:${"b".repeat(64)}`;
const authorizationId = `phase11-authz:${"c".repeat(64)}`;
const observedAt = new Date("2026-09-19T01:00:05.000Z");

function context(): Phase11HttpWorkerFinalizationContext {
  return {
    taskId: identity.taskId,
    attemptId: identity.attemptId,
    workspaceId: "44444444-4444-4444-8444-444444444444",
    runId: "55555555-5555-4555-8555-555555555555",
    actionId,
    authorizationId,
    authorizationSnapshotRef: "phase11-auth:fixture",
    targetNodeId: "target-node-1",
    capabilityId: "web.route.discover.v1",
    providerId: "scopeforge.http-discovery",
    providerVersion: "1.0.0",
    discoveryProfile: "well-known-safe",
    leasedAt: "2026-09-19T01:00:00.000Z",
    leaseExpiresAt: "2026-09-19T01:00:30.000Z",
    cancelRequested: false,
    finishedAt: null,
    priorOutcome: null,
    priorTerminalDigest: null,
  };
}

function terminal(outcome: "succeeded" | "failed" | "cancelled" = "succeeded") {
  return {
    schemaVersion: 1,
    taskId: identity.taskId,
    attemptId: identity.attemptId,
    executionClass: "phase11_http_discovery_v1",
    outcome,
    failureCode: outcome === "failed" ? "HTTP_DISCOVERY_NETWORK_ERROR" : null,
    metrics: {
      wallTimeMs: 1_000,
      cpuTimeMs: 500,
      peakMemoryBytes: 1_024,
      inputBytes: 128,
      outputBytes: 256,
    },
    result: outcome === "succeeded" ? {
      kind: "phase11_http_discovery",
      requestCount: 2,
      records: [{ routeKind: "security-txt", status: 200, contentType: "text/plain", redirected: false }],
    } : null,
  };
}

describe("Phase 11 HTTP worker finalization", () => {
  it("normalizes successful results using only authoritative target and authorization identity", async () => {
    const finalize = vi.fn(async (_input: unknown) => ({ outcome: "succeeded" as const, replayed: false }));
    const getContext = vi.fn(async () => context());

    await expect(finalizeLeasedPhase11HttpWorker({ ...identity, terminal: terminal() }, {
      getContext,
      finalize,
      now: () => observedAt,
    })).resolves.toEqual({ outcome: "succeeded", replayed: false });

    expect(getContext).toHaveBeenCalledWith(identity);
    expect(finalize).toHaveBeenCalledWith(expect.objectContaining({
      ...identity,
      workspaceId: context().workspaceId,
      runId: context().runId,
      actionId,
      authorizationId,
      authorizationSnapshotRef: context().authorizationSnapshotRef,
      outcome: "succeeded",
      failureCode: null,
      requestCount: 2,
      observations: [expect.objectContaining({
        runId: context().runId,
        providerId: "scopeforge.http-discovery",
        capabilityId: "web.route.discover.v1",
        assetNodeIds: ["target-node-1"],
        authorizationSnapshotRef: "phase11-auth:fixture",
        evidenceRefs: [`phase11-http-attempt:${identity.attemptId}:security-txt`],
        observedAt: observedAt.toISOString(),
      })],
    }));
    expect(JSON.stringify(finalize.mock.calls[0]?.[0])).not.toMatch(/https?:\/\//);
  });

  it("persists failed and cancelled terminals without observations", async () => {
    for (const outcome of ["failed", "cancelled"] as const) {
      const finalize = vi.fn(async (_input: unknown) => ({ outcome, replayed: false }));
      await finalizeLeasedPhase11HttpWorker({ ...identity, terminal: terminal(outcome) }, {
        getContext: async () => context(),
        finalize,
        now: () => observedAt,
      });
      expect(finalize).toHaveBeenCalledWith(expect.objectContaining({
        outcome,
        observations: [],
        requestCount: 0,
      }));
    }
  });

  it("turns a successful result into cancellation when authoritative cancellation won the race", async () => {
    const finalize = vi.fn(async (_input: unknown) => ({ outcome: "cancelled" as const, replayed: false }));
    await finalizeLeasedPhase11HttpWorker({ ...identity, terminal: terminal() }, {
      getContext: async () => ({ ...context(), cancelRequested: true }),
      finalize,
      now: () => observedAt,
    });
    expect(finalize).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "cancelled",
      failureCode: null,
      observations: [],
    }));
  });

  it("accepts only an exact terminal-digest replay and does not persist twice", async () => {
    const firstFinalize = vi.fn(async (_input: unknown) => ({ outcome: "succeeded" as const, replayed: false }));
    await finalizeLeasedPhase11HttpWorker({ ...identity, terminal: terminal() }, {
      getContext: async () => context(), finalize: firstFinalize, now: () => observedAt,
    });
    const firstCall = firstFinalize.mock.calls[0]?.[0] as { terminalDigest: string } | undefined;
    expect(firstCall).toBeDefined();
    const digest = firstCall!.terminalDigest;
    const replayFinalize = vi.fn();
    await expect(finalizeLeasedPhase11HttpWorker({ ...identity, terminal: terminal() }, {
      getContext: async () => ({
        ...context(), finishedAt: observedAt.toISOString(), priorOutcome: "succeeded", priorTerminalDigest: digest,
      }),
      finalize: replayFinalize,
      now: () => observedAt,
    })).resolves.toEqual({ outcome: "succeeded", replayed: true });
    expect(replayFinalize).not.toHaveBeenCalled();
  });

  it("fails closed for expired leases and conflicting completed attempts", async () => {
    await expect(finalizeLeasedPhase11HttpWorker({ ...identity, terminal: terminal() }, {
      getContext: async () => ({ ...context(), leaseExpiresAt: observedAt.toISOString() }),
      finalize: vi.fn(), now: () => observedAt,
    })).rejects.toThrow("PHASE11_HTTP_WORKER_AUTHORIZATION_FAILED");

    await expect(finalizeLeasedPhase11HttpWorker({ ...identity, terminal: terminal() }, {
      getContext: async () => ({
        ...context(), finishedAt: observedAt.toISOString(), priorOutcome: "succeeded", priorTerminalDigest: "0".repeat(64),
      }),
      finalize: vi.fn(), now: () => observedAt,
    })).rejects.toThrow("PHASE11_HTTP_WORKER_TERMINAL_CONFLICT");
  });

  it("rejects duplicate route observations instead of collapsing worker output", async () => {
    const duplicate = terminal();
    if (duplicate.result) {
      duplicate.result.records.push({ routeKind: "security-txt", status: 404, contentType: "text/plain", redirected: false });
    }
    await expect(finalizeLeasedPhase11HttpWorker({ ...identity, terminal: duplicate }, {
      getContext: async () => context(), finalize: vi.fn(), now: () => observedAt,
    })).rejects.toThrow("PHASE11_HTTP_WORKER_TERMINAL_INVALID");
  });
});
