import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/database.types";
import {
  requestActiveCorsRuntimeWorker,
  requestPassiveRuntimeWorker,
} from "@/lib/runtime-workers/request";
import { ACTIVE_VALIDATION_MAX_BUDGET, CORS_ORIGIN_POLICY_PROFILE } from "@/packages/runtime-validator";
import { RUNTIME_OBSERVATION_MAX_BUDGET } from "@/packages/runtime-observer";

type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
type ScanJobRow = Database["public"]["Tables"]["scan_jobs"]["Row"];

const createdAt = "2026-08-31T00:00:00.000Z";
const verifiedAt = "2026-08-31T00:01:00.000Z";

function asset(): AssetRow {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    workspace_id: "11111111-1111-4111-8111-111111111111",
    kind: "web_application",
    name: "Example",
    canonical_target: "https://example.com",
    hostname: "example.com",
    verification_status: "verified",
    verified_at: verifiedAt,
    verified_by: "33333333-3333-4333-8333-333333333333",
    created_by: "33333333-3333-4333-8333-333333333333",
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function job(kind: "passive_runtime" | "active_validation"): ScanJobRow {
  return {
    id: kind === "passive_runtime"
      ? "44444444-4444-4444-8444-444444444444"
      : "55555555-5555-4555-8555-555555555555",
    workspace_id: asset().workspace_id,
    asset_id: asset().id,
    job_kind: kind,
    status: "queued",
    requested_by: "33333333-3333-4333-8333-333333333333",
    blocked_reason: null,
    authorization_canonical_target: asset().canonical_target,
    authorization_asset_kind: asset().kind,
    authorization_verified_at: verifiedAt,
    validation_profile_id: kind === "active_validation" ? CORS_ORIGIN_POLICY_PROFILE.id : null,
    validation_profile_version: kind === "active_validation" ? CORS_ORIGIN_POLICY_PROFILE.version : null,
    authorization_granted_at: kind === "active_validation" ? "2026-08-31T00:02:00.000Z" : null,
    budget: kind === "active_validation" ? { ...ACTIVE_VALIDATION_MAX_BUDGET } : { ...RUNTIME_OBSERVATION_MAX_BUDGET },
    cancel_requested_at: null,
    started_at: null,
    finished_at: null,
    failure_code: null,
    request_count: 0,
    redirect_count: 0,
    finding_count: 0,
    created_at: createdAt,
  };
}

function dependencies(capabilities = { passiveRuntime: true, activeCors: true }) {
  return {
    capabilities,
    loadAsset: vi.fn(async () => asset()),
    queuePassive: vi.fn(async () => ({
      job: job("passive_runtime"),
      workerTask: {
        scanJobId: job("passive_runtime").id,
        taskId: "66666666-6666-4666-8666-666666666666",
        executionClass: "passive_runtime_observation_v1" as const,
        absoluteDeadlineAt: "2026-08-31T00:02:30.000Z",
      },
    })),
    queueActive: vi.fn(async () => ({
      job: job("active_validation"),
      workerTask: {
        scanJobId: job("active_validation").id,
        taskId: "77777777-7777-4777-8777-777777777777",
        executionClass: "active_cors_validation_v1" as const,
        absoluteDeadlineAt: "2026-08-31T00:02:20.000Z",
      },
    })),
    auditPassive: vi.fn(async () => undefined),
    auditActive: vi.fn(async () => undefined),
    now: () => new Date("2026-08-31T00:02:00.000Z"),
  };
}

describe("Phase 6D hosted runtime request boundary", () => {
  it("fails closed before asset lookup or job creation when passive workers are disabled", async () => {
    const deps = dependencies({ passiveRuntime: false, activeCors: true });

    await expect(requestPassiveRuntimeWorker({
      actorId: "33333333-3333-4333-8333-333333333333",
      workspaceId: asset().workspace_id,
      role: "member",
      assetId: asset().id,
    }, deps)).rejects.toMatchObject({ code: "RUNTIME_WORKER_UNAVAILABLE" });

    expect(deps.loadAsset).not.toHaveBeenCalled();
    expect(deps.queuePassive).not.toHaveBeenCalled();
  });

  it("queues passive work from the server-derived Phase 4 authorization snapshot", async () => {
    const deps = dependencies();
    const result = await requestPassiveRuntimeWorker({
      actorId: "33333333-3333-4333-8333-333333333333",
      workspaceId: asset().workspace_id,
      role: "member",
      assetId: asset().id,
    }, deps);

    expect(deps.queuePassive).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: asset().workspace_id,
      assetId: asset().id,
      requestedBy: "33333333-3333-4333-8333-333333333333",
      canonicalTarget: "https://example.com",
      assetKind: "web_application",
      verifiedAt,
      budget: RUNTIME_OBSERVATION_MAX_BUDGET,
    }));
    expect(result.job.status).toBe("queued");
    expect(result.workerTask.executionClass).toBe("passive_runtime_observation_v1");
  });

  it("requires the active capability before asset lookup or job creation", async () => {
    const deps = dependencies({ passiveRuntime: true, activeCors: false });

    await expect(requestActiveCorsRuntimeWorker({
      actorId: "33333333-3333-4333-8333-333333333333",
      workspaceId: asset().workspace_id,
      role: "owner",
      assetId: asset().id,
      explicitConsent: true,
    }, deps)).rejects.toMatchObject({ code: "RUNTIME_WORKER_UNAVAILABLE" });

    expect(deps.loadAsset).not.toHaveBeenCalled();
    expect(deps.queueActive).not.toHaveBeenCalled();
  });

  it("queues active CORS from the exact built-in profile and budget", async () => {
    const deps = dependencies();
    await requestActiveCorsRuntimeWorker({
      actorId: "33333333-3333-4333-8333-333333333333",
      workspaceId: asset().workspace_id,
      role: "owner",
      assetId: asset().id,
      explicitConsent: true,
    }, deps);

    expect(deps.queueActive).toHaveBeenCalledWith(expect.objectContaining({
      profileId: CORS_ORIGIN_POLICY_PROFILE.id,
      profileVersion: CORS_ORIGIN_POLICY_PROFILE.version,
      budget: ACTIVE_VALIDATION_MAX_BUDGET,
    }));
  });
});
