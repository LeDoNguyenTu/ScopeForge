import { describe, expect, it, vi } from "vitest";
import { runWorkerOnce } from "@/packages/worker-supervisor";
import { workerExecutionProfile } from "@/packages/worker-contracts";

const taskId = "11111111-1111-4111-8111-111111111111";
const attemptId = "22222222-2222-4222-8222-222222222222";
const runId = "33333333-3333-4333-8333-333333333333";
const actionId = "phase11-action:" + "a".repeat(64);
const authorizationId = "phase11-authz:" + "b".repeat(64);
const leaseToken = "c".repeat(64);

describe("Phase 11C HTTP supervisor routing", () => {
  it("uses the dedicated prepare/finalize path and runtime mediator executor", async () => {
    const task = {
      taskId,
      attemptId,
      executionClass: "phase11_http_discovery_v1" as const,
      leaseToken,
      absoluteDeadlineAt: "2099-09-19T00:00:30.000Z",
      budget: workerExecutionProfile("phase11_http_discovery_v1").budget,
      input: {
        kind: "phase11_http_discovery" as const,
        runId,
        actionId,
        authorizationId,
      },
    };

    const prepared = {
      taskId,
      workspaceId: "44444444-4444-4444-8444-444444444444",
      runId,
      actionId,
      authorizationId,
      authorizationSnapshotRef: "snapshot-1",
      targetNodeId: "node-1",
      target: {
        assetRef: "node-1",
        kind: "web_application" as const,
        canonicalUrl: "https://example.com/",
        hostname: "example.com",
      },
      capabilityId: "web.http.probe.v1" as const,
      discoveryProfile: "root-only" as const,
      methodProfile: "GET_ONLY" as const,
      followSameOriginRedirects: false,
      budget: {
        maxRequests: 1,
        perRequestTimeoutMs: 5_000,
        totalTimeoutMs: 5_000,
      },
      expiresAt: "2099-09-19T00:00:20.000Z",
    };

    const phase11HttpPrepare = vi.fn(async () => prepared);
    const phase11HttpFinalize = vi.fn(async () => ({
      outcome: "succeeded" as const,
      replayed: false,
    }));
    const genericFinalize = vi.fn(async () => ({
      outcome: "succeeded" as const,
      replayed: false,
    }));
    const runtimePrepare = vi.fn();
    const runtimeFinalize = vi.fn();

    const runtimeNetworkPreparer = {
      prepare: vi.fn(async ({ task: claimed }: { task: typeof task }) => ({
        contract: {
          taskId: claimed.taskId,
          attemptId: claimed.attemptId,
          executionClass: claimed.executionClass,
          absoluteDeadlineAt: claimed.absoluteDeadlineAt,
          budget: claimed.budget,
          input: {
            kind: "phase11_http_worker_prepared" as const,
            runId,
            actionId,
            authorizationId,
            mediatorSocketPath: "/run/scopeforge/test.sock",
            mediatorSession: {
              taskId,
              attemptId,
              executionClass: "phase11_http_discovery_v1" as const,
              nonce: "d".repeat(64),
            },
          },
        },
        cleanup: vi.fn(async () => undefined),
      })),
    };

    const execute = vi.fn(async () => ({
      schemaVersion: 1 as const,
      taskId,
      attemptId,
      executionClass: "phase11_http_discovery_v1" as const,
      outcome: "succeeded" as const,
      failureCode: null,
      metrics: {
        wallTimeMs: 10,
        cpuTimeMs: 0,
        peakMemoryBytes: 0,
        inputBytes: 0,
        outputBytes: 128,
      },
      result: {
        kind: "phase11_http_discovery" as const,
        requestCount: 1,
        records: [{
          routeKind: "root" as const,
          status: 200,
          contentType: "text/html",
          redirected: false,
        }],
      },
    }));

    await expect(runWorkerOnce({
      control: {
        claim: vi.fn(async () => task),
        heartbeat: vi.fn(async () => ({
          cancelRequested: false,
          leaseExpiresAt: "2099-09-19T00:00:20.000Z",
        })),
        finalize: genericFinalize,
        runtimePrepare,
        runtimeFinalize,
        phase11HttpPrepare,
        phase11HttpFinalize,
      },
      executor: { execute },
      runtimeNetworkPreparer: runtimeNetworkPreparer as never,
      heartbeatMs: 60_000,
      finalizationRetryDelayMs: 0,
      now: () => Date.parse("2026-09-19T00:00:00.000Z"),
    })).resolves.toEqual({
      status: "completed",
      outcome: "succeeded",
      replayed: false,
    });

    expect(phase11HttpPrepare).toHaveBeenCalledWith({
      taskId,
      attemptId,
      leaseToken,
    });
    expect(runtimePrepare).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(phase11HttpFinalize).toHaveBeenCalledWith({
      taskId,
      attemptId,
      leaseToken,
      terminal: expect.objectContaining({
        executionClass: "phase11_http_discovery_v1",
        outcome: "succeeded",
      }),
    });
    expect(runtimeFinalize).not.toHaveBeenCalled();
    expect(genericFinalize).not.toHaveBeenCalled();
  });
});
