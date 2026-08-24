import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/database.types";
import {
  enqueueActiveValidation,
  executeActiveValidation,
  type ActiveValidationServiceDependencies,
} from "@/lib/active-validation/service";
import type { ActiveValidationRepository } from "@/lib/active-validation/repository";
import { ACTIVE_VALIDATION_MAX_BUDGET } from "@/packages/runtime-validator";

type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
type ScanJobRow = Database["public"]["Tables"]["scan_jobs"]["Row"];

const verifiedAt = "2026-08-25T01:00:00.000Z";
const grantedAt = "2026-08-25T01:05:00.000Z";
const createdAt = "2026-08-25T00:00:00.000Z";

function asset(overrides: Partial<AssetRow> = {}): AssetRow {
  return {
    id: "asset-1",
    workspace_id: "workspace-1",
    kind: "web_application",
    name: "Example",
    canonical_target: "https://example.com/app",
    hostname: "example.com",
    verification_status: "verified",
    verified_at: verifiedAt,
    verified_by: "owner-1",
    created_by: "owner-1",
    created_at: createdAt,
    updated_at: createdAt,
    ...overrides,
  };
}

function job(overrides: Partial<ScanJobRow> = {}): ScanJobRow {
  return {
    id: "job-1",
    workspace_id: "workspace-1",
    asset_id: "asset-1",
    job_kind: "active_validation",
    status: "queued",
    requested_by: "owner-1",
    blocked_reason: null,
    authorization_canonical_target: "https://example.com/app",
    authorization_asset_kind: "web_application",
    authorization_verified_at: verifiedAt,
    validation_profile_id: "cors-origin-policy",
    validation_profile_version: 1,
    authorization_granted_at: grantedAt,
    budget: { ...ACTIVE_VALIDATION_MAX_BUDGET },
    cancel_requested_at: null,
    started_at: null,
    finished_at: null,
    failure_code: null,
    request_count: 0,
    redirect_count: 0,
    finding_count: 0,
    created_at: createdAt,
    ...overrides,
  };
}

function repository(overrides: Partial<ActiveValidationRepository> = {}): ActiveValidationRepository {
  const queued = job();
  const running = job({ status: "running", started_at: grantedAt });
  return {
    enqueue: vi.fn(async () => queued),
    load: vi.fn(async () => queued),
    loadForWorkspace: vi.fn(async () => running),
    markRunning: vi.fn(async () => running),
    markBlocked: vi.fn(async (_job, code, reason) => job({ status: "blocked", failure_code: code, blocked_reason: reason, finished_at: grantedAt })),
    markSucceeded: vi.fn(async (_job, counts) => job({ status: "succeeded", request_count: counts.requestCount, finding_count: counts.findingCount, finished_at: grantedAt })),
    markFailed: vi.fn(async (_job, code) => job({ status: "failed", failure_code: code, finished_at: grantedAt })),
    markCancelled: vi.fn(async () => job({ status: "cancelled", finished_at: grantedAt })),
    requestCancellation: vi.fn(async () => running),
    persistObservation: vi.fn(async () => undefined),
    listObservations: vi.fn(async () => []),
    ...overrides,
  } as ActiveValidationRepository;
}

function dependencies(
  repo: ActiveValidationRepository,
  overrides: Partial<ActiveValidationServiceDependencies> = {},
): ActiveValidationServiceDependencies {
  return {
    repository: repo,
    loadAsset: vi.fn(async () => asset()),
    audit: vi.fn(async () => undefined),
    now: () => new Date(grantedAt),
    ...overrides,
  };
}

describe("active validation service", () => {
  it("records a separate explicit authorization event when enqueueing", async () => {
    const repo = repository();
    const deps = dependencies(repo);

    await enqueueActiveValidation({
      actorId: "owner-1",
      workspaceId: "workspace-1",
      role: "owner",
      assetId: "asset-1",
      explicitConsent: true,
      budget: ACTIVE_VALIDATION_MAX_BUDGET,
    }, deps);

    expect(repo.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      profileId: "cors-origin-policy",
      profileVersion: 1,
      authorizationGrantedAt: grantedAt,
    }));
    expect(deps.audit).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "active_validation.authorized",
    }));
  });

  it("blocks authorization drift before any active validator network authority is invoked", async () => {
    const repo = repository();
    const validate = vi.fn();
    const deps = dependencies(repo, {
      loadAsset: vi.fn(async () => asset({ canonical_target: "https://example.com/changed" })),
      validate,
    });

    const result = await executeActiveValidation("job-1", deps);

    expect(result.status).toBe("blocked");
    expect(validate).not.toHaveBeenCalled();
    expect(repo.markBlocked).toHaveBeenCalled();
  });

  it("persists one bounded observation and maps deterministic runtime_validated findings", async () => {
    const repo = repository({
      load: vi.fn(async () => job()),
      loadForWorkspace: vi.fn(async () => job({ status: "running", started_at: grantedAt })),
    });
    const validate = vi.fn(async () => ({
      status: "succeeded" as const,
      requestCount: 1 as const,
      observation: {
        kind: "cors-policy" as const,
        url: "https://example.com/app",
        status: 200,
        allowedOrigin: "https://scopeforge.invalid",
        credentialsAllowed: true,
        variesOnOrigin: true,
      },
    }));
    const deps = dependencies(repo, { validate });

    const result = await executeActiveValidation("job-1", deps);

    expect(result.status).toBe("succeeded");
    expect(repo.persistObservation).toHaveBeenCalledTimes(1);
    expect(repo.markSucceeded).toHaveBeenCalledWith(expect.anything(), {
      requestCount: 1,
      findingCount: 1,
    });
    expect(result.findings[0]).toMatchObject({
      validation: "runtime_validated",
      severity: "high",
    });
  });

  it("persists no active data when DB-backed cancellation becomes visible after response metadata", async () => {
    let loadCount = 0;
    const cancelledRunning = job({
      status: "running",
      started_at: grantedAt,
      cancel_requested_at: "2026-08-25T01:06:00.000Z",
    });
    const repo = repository({
      load: vi.fn(async () => job()),
      loadForWorkspace: vi.fn(async () => {
        loadCount += 1;
        return loadCount >= 1 ? cancelledRunning : job({ status: "running", started_at: grantedAt });
      }),
    });
    const validate = vi.fn(async (_target, _budget, validatorDependencies) => {
      expect(await validatorDependencies?.isCancelled?.()).toBe(true);
      return { status: "cancelled" as const, requestCount: 1 as const };
    });
    const deps = dependencies(repo, { validate });

    const result = await executeActiveValidation("job-1", deps);

    expect(result.status).toBe("cancelled");
    expect(repo.persistObservation).not.toHaveBeenCalled();
    expect(repo.markSucceeded).not.toHaveBeenCalled();
  });
});
