import { describe, expect, it } from "vitest";
import type { Database, WorkspaceRole } from "@/lib/database.types";
import {
  authorizeRuntimeObservationEnqueue,
  reauthorizeRuntimeObservationExecution,
  RuntimeAuthorizationError,
  type RuntimeAuthorizationCode,
} from "@/lib/runtime-observations/authorization";
import { RUNTIME_OBSERVATION_MAX_BUDGET } from "@/packages/runtime-observer";

type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
type ScanJobRow = Database["public"]["Tables"]["scan_jobs"]["Row"];

const verifiedAt = "2026-08-24T12:00:00.000Z";
const createdAt = "2026-08-24T11:00:00.000Z";

function asset(overrides: Partial<AssetRow> = {}): AssetRow {
  return {
    id: "asset-1",
    workspace_id: "workspace-1",
    kind: "web_application",
    name: "Example",
    canonical_target: "https://example.com",
    hostname: "example.com",
    verification_status: "verified",
    verified_at: verifiedAt,
    verified_by: "user-1",
    created_by: "user-1",
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
    job_kind: "passive_runtime",
    status: "queued",
    requested_by: "user-1",
    blocked_reason: null,
    authorization_canonical_target: "https://example.com",
    authorization_asset_kind: "web_application",
    authorization_verified_at: verifiedAt,
    budget: { ...RUNTIME_OBSERVATION_MAX_BUDGET },
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

function expectAuthorizationCode(
  run: () => unknown,
  expectedCode: RuntimeAuthorizationCode,
): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(RuntimeAuthorizationError);
    expect((error as RuntimeAuthorizationError).code).toBe(expectedCode);
    return;
  }
  throw new Error(`Expected runtime authorization error ${expectedCode}`);
}

function enqueueInput(input: {
  actorId?: string | null;
  workspaceId?: string;
  role?: WorkspaceRole | null;
  selectedAsset?: AssetRow | null;
} = {}) {
  return {
    actorId: input.actorId === undefined ? "user-1" : input.actorId,
    workspaceId: input.workspaceId ?? "workspace-1",
    role: input.role === undefined ? "member" : input.role,
    asset: input.selectedAsset === undefined ? asset() : input.selectedAsset,
    budget: RUNTIME_OBSERVATION_MAX_BUDGET,
  };
}

describe("runtime observation enqueue authorization", () => {
  it("rejects unauthenticated requests", () => {
    expectAuthorizationCode(
      () => authorizeRuntimeObservationEnqueue(enqueueInput({ actorId: null })),
      "RUNTIME_UNAUTHENTICATED",
    );
  });

  it("rejects users without a contributing workspace role", () => {
    expectAuthorizationCode(
      () => authorizeRuntimeObservationEnqueue(enqueueInput({ role: "viewer" })),
      "RUNTIME_WORKSPACE_DENIED",
    );
  });

  it("does not authorize an asset from another workspace", () => {
    expectAuthorizationCode(
      () => authorizeRuntimeObservationEnqueue(enqueueInput({
        selectedAsset: asset({ workspace_id: "workspace-2" }),
      })),
      "RUNTIME_ASSET_NOT_AVAILABLE",
    );
  });

  it("rejects repository assets", () => {
    expectAuthorizationCode(
      () => authorizeRuntimeObservationEnqueue(enqueueInput({
        selectedAsset: asset({
          kind: "repository",
          canonical_target: "https://github.com/example/repo",
          hostname: "github.com",
        }),
      })),
      "RUNTIME_ASSET_UNSUPPORTED",
    );
  });

  it("rejects unverified assets", () => {
    expectAuthorizationCode(
      () => authorizeRuntimeObservationEnqueue(enqueueInput({
        selectedAsset: asset({ verification_status: "unverified", verified_at: null }),
      })),
      "RUNTIME_ASSET_UNVERIFIED",
    );
  });

  it("authorizes a verified web asset and returns the exact immutable snapshot", () => {
    const result = authorizeRuntimeObservationEnqueue(enqueueInput());

    expect(result.enqueueInput).toEqual({
      workspaceId: "workspace-1",
      assetId: "asset-1",
      requestedBy: "user-1",
      canonicalTarget: "https://example.com",
      assetKind: "web_application",
      verifiedAt,
      budget: RUNTIME_OBSERVATION_MAX_BUDGET,
    });
    expect(result.target).toMatchObject({
      assetRef: "asset-1",
      kind: "web_application",
      canonicalUrl: "https://example.com",
      hostname: "example.com",
    });
  });

  it("authorizes a verified API asset", () => {
    const result = authorizeRuntimeObservationEnqueue(enqueueInput({
      selectedAsset: asset({
        kind: "api",
        canonical_target: "https://api.example.com/v1",
        hostname: "api.example.com",
      }),
    }));

    expect(result.enqueueInput.assetKind).toBe("api");
    expect(result.target.kind).toBe("api");
    expect(result.target.canonicalUrl).toBe("https://api.example.com/v1");
  });
});

describe("runtime observation execution re-authorization", () => {
  it("blocks a missing asset", () => {
    expectAuthorizationCode(
      () => reauthorizeRuntimeObservationExecution({ job: job(), asset: null }),
      "RUNTIME_ASSET_NOT_AVAILABLE",
    );
  });

  it("blocks a workspace mismatch", () => {
    expectAuthorizationCode(
      () => reauthorizeRuntimeObservationExecution({
        job: job(),
        asset: asset({ workspace_id: "workspace-2" }),
      }),
      "RUNTIME_ASSET_NOT_AVAILABLE",
    );
  });

  it("blocks an asset that is no longer verified", () => {
    expectAuthorizationCode(
      () => reauthorizeRuntimeObservationExecution({
        job: job(),
        asset: asset({ verification_status: "unverified", verified_at: null }),
      }),
      "RUNTIME_ASSET_UNVERIFIED",
    );
  });

  it("blocks a changed verification timestamp", () => {
    expectAuthorizationCode(
      () => reauthorizeRuntimeObservationExecution({
        job: job(),
        asset: asset({ verified_at: "2026-08-24T12:30:00.000Z" }),
      }),
      "RUNTIME_AUTHORIZATION_CHANGED",
    );
  });

  it("blocks a changed canonical target", () => {
    expectAuthorizationCode(
      () => reauthorizeRuntimeObservationExecution({
        job: job(),
        asset: asset({
          canonical_target: "https://example.com/new-root",
        }),
      }),
      "RUNTIME_AUTHORIZATION_CHANGED",
    );
  });

  it("stops when cancellation was already requested", () => {
    expectAuthorizationCode(
      () => reauthorizeRuntimeObservationExecution({
        job: job({ cancel_requested_at: "2026-08-24T12:05:00.000Z" }),
        asset: asset(),
      }),
      "RUNTIME_CANCELLATION_REQUESTED",
    );
  });

  it("returns only a validated target and budget for an unchanged snapshot", () => {
    const result = reauthorizeRuntimeObservationExecution({
      job: job(),
      asset: asset(),
    });

    expect(result.target).toMatchObject({
      assetRef: "asset-1",
      kind: "web_application",
      canonicalUrl: "https://example.com",
      hostname: "example.com",
    });
    expect(result.budget).toEqual(RUNTIME_OBSERVATION_MAX_BUDGET);
  });
});
