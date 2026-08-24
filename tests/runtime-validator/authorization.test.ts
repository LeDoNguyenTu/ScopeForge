import { describe, expect, it } from "vitest";
import type { Database, WorkspaceRole } from "@/lib/database.types";
import {
  ActiveValidationAuthorizationError,
  authorizeActiveValidationEnqueue,
  reauthorizeActiveValidationExecution,
  type ActiveValidationAuthorizationCode,
} from "@/lib/active-validation/authorization";
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

function expectCode(run: () => unknown, expected: ActiveValidationAuthorizationCode): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ActiveValidationAuthorizationError);
    expect((error as ActiveValidationAuthorizationError).code).toBe(expected);
    return;
  }
  throw new Error(`Expected active authorization error ${expected}`);
}

function enqueueInput(overrides: {
  actorId?: string | null;
  role?: WorkspaceRole | null;
  explicitConsent?: boolean;
  selectedAsset?: AssetRow | null;
} = {}) {
  return {
    actorId: overrides.actorId === undefined ? "owner-1" : overrides.actorId,
    workspaceId: "workspace-1",
    role: overrides.role === undefined ? "owner" : overrides.role,
    asset: overrides.selectedAsset === undefined ? asset() : overrides.selectedAsset,
    explicitConsent: overrides.explicitConsent ?? true,
    authorizationGrantedAt: grantedAt,
    budget: ACTIVE_VALIDATION_MAX_BUDGET,
  };
}

describe("active validation enqueue authorization", () => {
  it("requires owner/admin role and a separate explicit active authorization event", () => {
    expectCode(
      () => authorizeActiveValidationEnqueue(enqueueInput({ role: "member" })),
      "ACTIVE_WORKSPACE_DENIED",
    );
    expectCode(
      () => authorizeActiveValidationEnqueue(enqueueInput({ explicitConsent: false })),
      "ACTIVE_EXPLICIT_AUTHORIZATION_REQUIRED",
    );
  });

  it("records the immutable active profile and authorization snapshot", () => {
    const result = authorizeActiveValidationEnqueue(enqueueInput());

    expect(result.enqueueInput).toEqual({
      workspaceId: "workspace-1",
      assetId: "asset-1",
      requestedBy: "owner-1",
      canonicalTarget: "https://example.com/app",
      assetKind: "web_application",
      verifiedAt,
      profileId: "cors-origin-policy",
      profileVersion: 1,
      authorizationGrantedAt: grantedAt,
      budget: ACTIVE_VALIDATION_MAX_BUDGET,
    });
    expect(result.target.canonicalUrl).toBe("https://example.com/app");
  });
});

describe("active validation execution reauthorization", () => {
  it("blocks changed target, revoked verification, profile drift, and pre-network cancellation", () => {
    expectCode(
      () => reauthorizeActiveValidationExecution({
        job: job(),
        asset: asset({ canonical_target: "https://example.com/new" }),
      }),
      "ACTIVE_AUTHORIZATION_CHANGED",
    );
    expectCode(
      () => reauthorizeActiveValidationExecution({
        job: job(),
        asset: asset({ verification_status: "unverified", verified_at: null }),
      }),
      "ACTIVE_ASSET_UNVERIFIED",
    );
    expectCode(
      () => reauthorizeActiveValidationExecution({
        job: job({ validation_profile_version: 2 }),
        asset: asset(),
      }),
      "ACTIVE_PROFILE_INVALID",
    );
    expectCode(
      () => reauthorizeActiveValidationExecution({
        job: job({ cancel_requested_at: grantedAt }),
        asset: asset(),
      }),
      "ACTIVE_CANCELLATION_REQUESTED",
    );
  });

  it("returns the locked target and budget only for an unchanged queued snapshot", () => {
    const result = reauthorizeActiveValidationExecution({ job: job(), asset: asset() });

    expect(result.target).toMatchObject({
      kind: "web_application",
      canonicalUrl: "https://example.com/app",
      hostname: "example.com",
    });
    expect(result.budget).toEqual(ACTIVE_VALIDATION_MAX_BUDGET);
  });
});
