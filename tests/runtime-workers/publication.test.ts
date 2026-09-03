import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/database.types";
import { publishRuntimeWorkerTerminal } from "@/lib/runtime-workers/publication";
import type {
  RuntimeWorkerFinalizationContext,
  RuntimeWorkerPublicationDependencies,
} from "@/lib/runtime-workers/publication";
import { RUNTIME_OBSERVATION_MAX_BUDGET } from "@/packages/runtime-observer";
import { ACTIVE_VALIDATION_MAX_BUDGET, CORS_ORIGIN_POLICY_PROFILE } from "@/packages/runtime-validator";

type ScanJobRow = Database["public"]["Tables"]["scan_jobs"]["Row"];

const workerId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const attemptId = "33333333-3333-4333-8333-333333333333";
const domainJobId = "44444444-4444-4444-8444-444444444444";
const workspaceId = "55555555-5555-4555-8555-555555555555";
const assetId = "66666666-6666-4666-8666-666666666666";
const actorId = "77777777-7777-4777-8777-777777777777";
const leaseToken = "a".repeat(64);
const observedAt = new Date("2026-08-31T01:00:00.000Z");

function finalizationContext(
  executionClass: RuntimeWorkerFinalizationContext["executionClass"],
  overrides: Partial<RuntimeWorkerFinalizationContext> = {},
): RuntimeWorkerFinalizationContext {
  return {
    taskId,
    attemptId,
    executionClass,
    domainJobId,
    workspaceId,
    assetId,
    cancelRequested: false,
    leaseExpiresAt: "2026-08-31T01:00:30.000Z",
    finishedAt: null,
    priorOutcome: null,
    priorTerminalDigest: null,
    ...overrides,
  };
}

function job(kind: "passive_runtime" | "active_validation", overrides: Partial<ScanJobRow> = {}): ScanJobRow {
  return {
    id: domainJobId,
    workspace_id: workspaceId,
    asset_id: assetId,
    job_kind: kind,
    status: "running",
    requested_by: actorId,
    blocked_reason: null,
    authorization_canonical_target: "https://example.com",
    authorization_asset_kind: "web_application",
    authorization_verified_at: "2026-08-31T00:00:00.000Z",
    validation_profile_id: kind === "active_validation" ? CORS_ORIGIN_POLICY_PROFILE.id : null,
    validation_profile_version: kind === "active_validation" ? CORS_ORIGIN_POLICY_PROFILE.version : null,
    authorization_granted_at: kind === "active_validation" ? "2026-08-31T00:00:01.000Z" : null,
    budget: kind === "active_validation" ? { ...ACTIVE_VALIDATION_MAX_BUDGET } : { ...RUNTIME_OBSERVATION_MAX_BUDGET },
    cancel_requested_at: null,
    started_at: "2026-08-31T00:59:50.000Z",
    finished_at: null,
    failure_code: null,
    request_count: 0,
    redirect_count: 0,
    finding_count: 0,
    created_at: "2026-08-31T00:59:45.000Z",
    ...overrides,
  };
}

function terminal(executionClass: "passive_runtime_observation_v1" | "active_cors_validation_v1") {
  return executionClass === "passive_runtime_observation_v1"
    ? {
        schemaVersion: 1 as const,
        taskId,
        attemptId,
        executionClass,
        outcome: "succeeded" as const,
        failureCode: null,
        metrics: { wallTimeMs: 10, cpuTimeMs: 0, peakMemoryBytes: 0, inputBytes: 0, outputBytes: 256 },
        result: {
          kind: "passive_runtime_observation" as const,
          requestCount: 1,
          redirectCount: 0,
          observations: [
            { kind: "header" as const, name: "strict-transport-security", present: false as const },
          ],
        },
      }
    : {
        schemaVersion: 1 as const,
        taskId,
        attemptId,
        executionClass,
        outcome: "succeeded" as const,
        failureCode: null,
        metrics: { wallTimeMs: 10, cpuTimeMs: 0, peakMemoryBytes: 0, inputBytes: 0, outputBytes: 256 },
        result: {
          kind: "active_cors_validation" as const,
          requestCount: 1 as const,
          observation: {
            kind: "cors-policy" as const,
            url: "https://example.com/",
            status: 200,
            allowedOrigin: "https://scopeforge.invalid",
            credentialsAllowed: true,
            variesOnOrigin: false,
          },
        },
      };
}

function dependencies(executionClass: "passive_runtime_observation_v1" | "active_cors_validation_v1", cancelled = false): RuntimeWorkerPublicationDependencies {
  return {
    getContext: vi.fn(async () => finalizationContext(executionClass, {
      cancelRequested: cancelled,
    })),
    loadPassiveJob: vi.fn(async () => executionClass === "passive_runtime_observation_v1" ? job("passive_runtime", cancelled ? { cancel_requested_at: observedAt.toISOString() } : {}) : null),
    loadActiveJob: vi.fn(async () => executionClass === "active_cors_validation_v1" ? job("active_validation", cancelled ? { cancel_requested_at: observedAt.toISOString() } : {}) : null),
    publishPassiveSuccess: vi.fn(async (input) => ({ outcome: input.finalization.outcome, replayed: false })),
    publishActiveSuccess: vi.fn(async (input) => ({ outcome: input.finalization.outcome, replayed: false })),
    finalize: vi.fn(async (input) => ({ outcome: input.outcome, replayed: false })),
    now: () => observedAt,
  };
}

const identity = { workerId, taskId, attemptId, leaseToken };

describe("Phase 6D trusted publication", () => {
  it("reruns passive deterministic rules and atomically publishes mapped findings/evidence", async () => {
    const deps = dependencies("passive_runtime_observation_v1");
    const result = await publishRuntimeWorkerTerminal({ ...identity, terminal: terminal("passive_runtime_observation_v1") }, deps);

    expect(deps.publishPassiveSuccess).toHaveBeenCalledTimes(1);
    const call = vi.mocked(deps.publishPassiveSuccess).mock.calls[0]?.[0];
    expect(call?.publication.observations).toHaveLength(1);
    expect(call?.publication.findings.length).toBeGreaterThan(0);
    expect(call?.publication.evidence.length).toBeGreaterThan(0);
    expect(String(call?.publication.findings[0]?.source.sourceId)).toBe("scopeforge:runtime-observer");
    expect(call?.finalization).toEqual(expect.objectContaining({
      outcome: "succeeded",
      requestCount: 1,
      redirectCount: 0,
      findingCount: call?.publication.findings.length,
    }));
    expect(deps.finalize).not.toHaveBeenCalled();
    expect(result).toEqual({ outcome: "succeeded", replayed: false });
  });

  it("reruns active CORS rules and atomically publishes only the normalized observation", async () => {
    const deps = dependencies("active_cors_validation_v1");
    await publishRuntimeWorkerTerminal({ ...identity, terminal: terminal("active_cors_validation_v1") }, deps);

    expect(deps.publishActiveSuccess).toHaveBeenCalledTimes(1);
    const call = vi.mocked(deps.publishActiveSuccess).mock.calls[0]?.[0];
    expect(call?.publication.observation.kind).toBe("cors-policy");
    expect(call?.publication.findings.length).toBeGreaterThan(0);
    expect(call?.finalization).toEqual(expect.objectContaining({
      outcome: "succeeded",
      requestCount: 1,
      redirectCount: 0,
      findingCount: call?.publication.findings.length,
    }));
    expect(deps.finalize).not.toHaveBeenCalled();
  });

  it("makes cancellation win before persistence even when a late success arrives", async () => {
    const deps = dependencies("passive_runtime_observation_v1", true);
    const result = await publishRuntimeWorkerTerminal({ ...identity, terminal: terminal("passive_runtime_observation_v1") }, deps);

    expect(deps.publishPassiveSuccess).not.toHaveBeenCalled();
    expect(deps.publishActiveSuccess).not.toHaveBeenCalled();
    expect(deps.finalize).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "cancelled",
      requestCount: 0,
      redirectCount: 0,
      findingCount: 0,
    }));
    expect(result.outcome).toBe("cancelled");
  });

  it("rejects an expired late success without publishing observations or findings", async () => {
    const deps = dependencies("passive_runtime_observation_v1");
    deps.getContext = vi.fn(async () => finalizationContext("passive_runtime_observation_v1", {
      leaseExpiresAt: "2026-08-31T00:59:59.000Z",
    }));

    await expect(publishRuntimeWorkerTerminal({ ...identity, terminal: terminal("passive_runtime_observation_v1") }, deps)).rejects.toMatchObject({
      code: "RUNTIME_WORKER_AUTHORIZATION_FAILED",
    });
    expect(deps.publishPassiveSuccess).not.toHaveBeenCalled();
    expect(deps.publishActiveSuccess).not.toHaveBeenCalled();
    expect(deps.finalize).not.toHaveBeenCalled();
  });

  it("does not publish malformed or cross-class success output", async () => {
    const deps = dependencies("passive_runtime_observation_v1");
    const malformed = {
      ...terminal("passive_runtime_observation_v1"),
      result: { kind: "passive_runtime_observation", requestCount: 1, redirectCount: 0, observations: [], rawBody: "secret" },
    };
    await expect(publishRuntimeWorkerTerminal({ ...identity, terminal: malformed }, deps)).rejects.toThrow();
    expect(deps.publishPassiveSuccess).not.toHaveBeenCalled();
    expect(deps.publishActiveSuccess).not.toHaveBeenCalled();
    expect(deps.finalize).not.toHaveBeenCalled();
  });

  it("returns deterministic replay only for the same terminal digest and rejects conflicts", async () => {
    const value = terminal("passive_runtime_observation_v1");
    const first = dependencies("passive_runtime_observation_v1");
    const accepted = await publishRuntimeWorkerTerminal({ ...identity, terminal: value }, first);
    const finalizationInput = vi.mocked(first.publishPassiveSuccess).mock.calls[0]?.[0]?.finalization;
    expect(finalizationInput?.terminalDigest).toMatch(/^[a-f0-9]{64}$/);

    const replay = dependencies("passive_runtime_observation_v1");
    replay.getContext = vi.fn(async () => finalizationContext("passive_runtime_observation_v1", {
      finishedAt: observedAt.toISOString(),
      priorOutcome: accepted.outcome,
      priorTerminalDigest: finalizationInput?.terminalDigest ?? null,
    }));
    await expect(publishRuntimeWorkerTerminal({ ...identity, terminal: value }, replay)).resolves.toEqual({ outcome: "succeeded", replayed: true });
    expect(replay.publishPassiveSuccess).not.toHaveBeenCalled();

    replay.getContext = vi.fn(async () => finalizationContext("passive_runtime_observation_v1", {
      finishedAt: observedAt.toISOString(),
      priorOutcome: "succeeded",
      priorTerminalDigest: "f".repeat(64),
    }));
    await expect(publishRuntimeWorkerTerminal({ ...identity, terminal: value }, replay)).rejects.toThrow();
  });
});
