import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/database.types";
import { prepareRuntimeWorkerExecution } from "@/lib/runtime-workers/preparation";
import type { RuntimeWorkerPreparationDependencies } from "@/lib/runtime-workers/preparation";
import { ACTIVE_VALIDATION_MAX_BUDGET, CORS_ORIGIN_POLICY_PROFILE } from "@/packages/runtime-validator";
import { RUNTIME_OBSERVATION_MAX_BUDGET } from "@/packages/runtime-observer";

type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
type ScanJobRow = Database["public"]["Tables"]["scan_jobs"]["Row"];

const workerId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const attemptId = "33333333-3333-4333-8333-333333333333";
const jobId = "44444444-4444-4444-8444-444444444444";
const workspaceId = "55555555-5555-4555-8555-555555555555";
const assetId = "66666666-6666-4666-8666-666666666666";
const actorId = "77777777-7777-4777-8777-777777777777";
const leaseToken = "a".repeat(64);
const verifiedAt = "2026-08-31T00:00:00.000Z";
const now = new Date("2026-08-31T00:00:05.000Z");

function asset(overrides: Partial<AssetRow> = {}): AssetRow {
  return {
    id: assetId,
    workspace_id: workspaceId,
    kind: "web_application",
    name: "Example",
    canonical_target: "https://example.com",
    hostname: "example.com",
    verification_status: "verified",
    verified_at: verifiedAt,
    verified_by: actorId,
    created_by: actorId,
    created_at: verifiedAt,
    updated_at: verifiedAt,
    ...overrides,
  };
}

function passiveJob(overrides: Partial<ScanJobRow> = {}): ScanJobRow {
  return {
    id: jobId,
    workspace_id: workspaceId,
    asset_id: assetId,
    job_kind: "passive_runtime",
    status: "queued",
    requested_by: actorId,
    blocked_reason: null,
    authorization_canonical_target: "https://example.com",
    authorization_asset_kind: "web_application",
    authorization_verified_at: verifiedAt,
    validation_profile_id: null,
    validation_profile_version: null,
    authorization_granted_at: null,
    budget: { ...RUNTIME_OBSERVATION_MAX_BUDGET },
    cancel_requested_at: null,
    started_at: null,
    finished_at: null,
    failure_code: null,
    request_count: 0,
    redirect_count: 0,
    finding_count: 0,
    created_at: verifiedAt,
    ...overrides,
  };
}

function activeJob(overrides: Partial<ScanJobRow> = {}): ScanJobRow {
  return passiveJob({
    job_kind: "active_validation",
    validation_profile_id: CORS_ORIGIN_POLICY_PROFILE.id,
    validation_profile_version: CORS_ORIGIN_POLICY_PROFILE.version,
    authorization_granted_at: "2026-08-31T00:00:01.000Z",
    budget: { ...ACTIVE_VALIDATION_MAX_BUDGET },
    ...overrides,
  });
}

function context(kind: "passive" | "active" = "passive") {
  return Object.freeze({
    taskId,
    attemptId,
    executionClass: kind === "passive"
      ? "passive_runtime_observation_v1" as const
      : "active_cors_validation_v1" as const,
    domainJobId: jobId,
    workspaceId,
    assetId,
    requestedBy: actorId,
    domainJobKind: kind === "passive" ? "passive_runtime" as const : "active_validation" as const,
    leaseExpiresAt: kind === "passive"
      ? "2026-08-31T00:00:30.000Z"
      : "2026-08-31T00:00:20.000Z",
    absoluteDeadlineAt: kind === "passive"
      ? "2026-08-31T00:00:30.000Z"
      : "2026-08-31T00:00:20.000Z",
  });
}

function dependencies(kind: "passive" | "active" = "passive", overrides: Partial<RuntimeWorkerPreparationDependencies> = {}): RuntimeWorkerPreparationDependencies {
  const job = kind === "passive" ? passiveJob() : activeJob();
  return {
    getPreparationContext: vi.fn(async () => context(kind)),
    loadAsset: vi.fn(async () => asset()),
    loadPassiveJob: vi.fn(async () => kind === "passive" ? job : null),
    loadActiveJob: vi.fn(async () => kind === "active" ? job : null),
    markPassiveRunning: vi.fn(async (value) => ({ ...value, status: "running" as const, started_at: now.toISOString() })),
    markActiveRunning: vi.fn(async (value) => ({ ...value, status: "running" as const, started_at: now.toISOString() })),
    now: () => now,
    ...overrides,
  };
}

const input = Object.freeze({ workerId, taskId, attemptId, leaseToken });

describe("Phase 6D runtime worker preparation", () => {
  it("reauthorizes the current passive asset and returns a deadline-bound closed profile", async () => {
    const deps = dependencies("passive");
    const result = await prepareRuntimeWorkerExecution(input, deps);

    expect(deps.getPreparationContext).toHaveBeenCalledWith(input);
    expect(deps.loadAsset).toHaveBeenCalledWith(assetId, workspaceId);
    expect(deps.markPassiveRunning).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      taskId,
      attemptId,
      executionClass: "passive_runtime_observation_v1",
      domainJobId: jobId,
      expiresAt: "2026-08-31T00:00:30.000Z",
      target: {
        assetRef: `asset:${assetId}`,
        kind: "web_application",
        canonicalUrl: "https://example.com",
        hostname: "example.com",
      },
      budget: RUNTIME_OBSERVATION_MAX_BUDGET,
    });
    expect(JSON.stringify(result)).not.toMatch(/requestedBy|leaseToken|authorizationGrantedAt|credential|secret/i);
  });

  it("reauthorizes active CORS using the exact approved profile and budget", async () => {
    const deps = dependencies("active");
    const result = await prepareRuntimeWorkerExecution(input, deps);

    expect(deps.markActiveRunning).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      executionClass: "active_cors_validation_v1",
      domainJobId: jobId,
      expiresAt: "2026-08-31T00:00:20.000Z",
      target: { canonicalUrl: "https://example.com", hostname: "example.com" },
      budget: ACTIVE_VALIDATION_MAX_BUDGET,
    });
  });

  it("caps profile expiry to the earlier lease or absolute deadline", async () => {
    const deps = dependencies("passive", {
      getPreparationContext: vi.fn(async () => ({
        ...context("passive"),
        leaseExpiresAt: "2026-08-31T00:00:18.000Z",
        absoluteDeadlineAt: "2026-08-31T00:00:30.000Z",
      })),
    });
    await expect(prepareRuntimeWorkerExecution(input, deps)).resolves.toMatchObject({
      expiresAt: "2026-08-31T00:00:18.000Z",
    });
  });

  it.each([
    ["canonical target", asset({ canonical_target: "https://changed.example.com", hostname: "changed.example.com" })],
    ["asset kind", asset({ kind: "api", authorization_state: undefined } as never)],
    ["verification timestamp", asset({ verified_at: "2026-08-31T00:00:02.000Z" })],
    ["unverified asset", asset({ verification_status: "unverified", verified_at: null })],
  ])("blocks passive preparation when current %s no longer matches authorization", async (_label, changedAsset) => {
    const deps = dependencies("passive", { loadAsset: vi.fn(async () => changedAsset) });
    await expect(prepareRuntimeWorkerExecution(input, deps)).rejects.toMatchObject({
      code: "RUNTIME_WORKER_AUTHORIZATION_FAILED",
    });
    expect(deps.markPassiveRunning).not.toHaveBeenCalled();
  });

  it("blocks cancellation, wrong job status, wrong class pairing, and expired preparation before running", async () => {
    const cancelled = dependencies("passive", {
      loadPassiveJob: vi.fn(async () => passiveJob({ cancel_requested_at: "2026-08-31T00:00:04.000Z" })),
    });
    await expect(prepareRuntimeWorkerExecution(input, cancelled)).rejects.toMatchObject({ code: "RUNTIME_WORKER_AUTHORIZATION_FAILED" });
    expect(cancelled.markPassiveRunning).not.toHaveBeenCalled();

    const running = dependencies("passive", {
      loadPassiveJob: vi.fn(async () => passiveJob({ status: "running" })),
    });
    await expect(prepareRuntimeWorkerExecution(input, running)).rejects.toMatchObject({ code: "RUNTIME_WORKER_AUTHORIZATION_FAILED" });
    expect(running.markPassiveRunning).not.toHaveBeenCalled();

    const wrongPair = dependencies("passive", {
      getPreparationContext: vi.fn(async () => ({ ...context("passive"), domainJobKind: "active_validation" as const })),
    });
    await expect(prepareRuntimeWorkerExecution(input, wrongPair)).rejects.toMatchObject({ code: "RUNTIME_WORKER_TASK_INVALID" });

    const expired = dependencies("passive", {
      getPreparationContext: vi.fn(async () => ({
        ...context("passive"),
        leaseExpiresAt: "2026-08-31T00:00:04.000Z",
        absoluteDeadlineAt: "2026-08-31T00:00:04.000Z",
      })),
    });
    await expect(prepareRuntimeWorkerExecution(input, expired)).rejects.toMatchObject({ code: "RUNTIME_WORKER_TASK_INVALID" });
    expect(expired.markPassiveRunning).not.toHaveBeenCalled();
  });

  it("blocks active preparation if profile consent or exact CORS budget is invalid", async () => {
    const missingConsent = dependencies("active", {
      loadActiveJob: vi.fn(async () => activeJob({ authorization_granted_at: null })),
    });
    await expect(prepareRuntimeWorkerExecution(input, missingConsent)).rejects.toMatchObject({ code: "RUNTIME_WORKER_AUTHORIZATION_FAILED" });
    expect(missingConsent.markActiveRunning).not.toHaveBeenCalled();

    const changedBudget = dependencies("active", {
      loadActiveJob: vi.fn(async () => activeJob({ budget: { ...ACTIVE_VALIDATION_MAX_BUDGET, maxRequests: 2 } })),
    });
    await expect(prepareRuntimeWorkerExecution(input, changedBudget)).rejects.toMatchObject({ code: "RUNTIME_WORKER_AUTHORIZATION_FAILED" });
    expect(changedBudget.markActiveRunning).not.toHaveBeenCalled();
  });
});
