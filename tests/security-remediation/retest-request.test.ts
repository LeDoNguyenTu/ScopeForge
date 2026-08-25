import { describe, expect, it, vi } from "vitest";
import type {
  SecurityFindingRetestRow,
  SecurityFindingRow,
} from "@/lib/database.types";
import { requestFindingRetest } from "@/lib/security-remediation/service";

function finding(overrides: Partial<SecurityFindingRow> = {}): SecurityFindingRow {
  return {
    workspace_id: "workspace-1",
    finding_id: "finding-1",
    asset_id: "asset-1",
    source_kind: "deterministic-runtime-scanner",
    source_id: "scopeforge:runtime-observer",
    source_version: "0.1.0",
    rule_ref: "runtime:test",
    title: "Test finding",
    description: "Test description",
    severity: "medium",
    confidence: "high",
    validation_state: "runtime_observed",
    provenance_kind: "scanner-derived",
    location: null,
    taxonomy: {},
    remediation: null,
    lifecycle_state: "resolved",
    first_seen_at: "2026-08-25T00:00:00.000Z",
    last_seen_at: "2026-08-25T00:00:00.000Z",
    last_seen_job_id: "job-1",
    created_at: "2026-08-25T00:00:00.000Z",
    updated_at: "2026-08-25T00:00:00.000Z",
    ...overrides,
  };
}

const passiveRetest: SecurityFindingRetestRow = {
  id: "retest-1",
  workspace_id: "workspace-1",
  finding_id: "finding-1",
  asset_id: "asset-1",
  requested_by: "user-1",
  execution_kind: "passive_runtime",
  source_id: "scopeforge:runtime-observer",
  source_version: "0.1.0",
  rule_ref: "runtime:test",
  validation_profile_id: null,
  validation_profile_version: null,
  active_consent_granted_at: null,
  status: "requested",
  scan_job_id: null,
  result_code: null,
  requested_at: "2026-08-25T00:00:00.000Z",
  started_at: null,
  completed_at: null,
};

function dependencies(targetFinding: SecurityFindingRow | null = finding()) {
  const repository = {
    loadFinding: vi.fn(async () => targetFinding),
    changeFindingWork: vi.fn(),
    requestFindingRetest: vi.fn(async () => passiveRetest),
  };
  return { repository };
}

describe("requestFindingRetest", () => {
  it("requires the canonical finding to be resolved", async () => {
    const deps = dependencies(finding({ lifecycle_state: "in_progress" }));
    await expect(requestFindingRetest({
      actorId: "user-1",
      workspaceId: "workspace-1",
      role: "owner",
      findingId: "finding-1",
      explicitConsent: false,
    }, deps)).rejects.toMatchObject({ code: "SECURITY_RETEST_STATE_INVALID" });
    expect(deps.repository.requestFindingRetest).not.toHaveBeenCalled();
  });

  it("rejects findings outside the closed source registry", async () => {
    const deps = dependencies(finding({ source_id: "scopeforge:unknown" }));
    await expect(requestFindingRetest({
      actorId: "user-1",
      workspaceId: "workspace-1",
      role: "owner",
      findingId: "finding-1",
      explicitConsent: false,
    }, deps)).rejects.toMatchObject({ code: "SECURITY_RETEST_UNSUPPORTED_SOURCE" });
  });

  it("requires explicit consent for active CORS validation", async () => {
    const deps = dependencies(finding({
      source_id: "scopeforge:runtime-validator",
      source_version: "cors-origin-policy@1",
      rule_ref: "cors-origin-policy@1:cors-untrusted-origin-allowed",
      validation_state: "runtime_validated",
    }));
    await expect(requestFindingRetest({
      actorId: "user-1",
      workspaceId: "workspace-1",
      role: "owner",
      findingId: "finding-1",
      explicitConsent: false,
    }, deps)).rejects.toMatchObject({ code: "SECURITY_RETEST_CONSENT_REQUIRED" });
  });

  it("rejects members from active validation even with consent", async () => {
    const deps = dependencies(finding({
      source_id: "scopeforge:runtime-validator",
      source_version: "cors-origin-policy@1",
      rule_ref: "cors-origin-policy@1:cors-untrusted-origin-allowed",
      validation_state: "runtime_validated",
    }));
    await expect(requestFindingRetest({
      actorId: "user-1",
      workspaceId: "workspace-1",
      role: "member",
      findingId: "finding-1",
      explicitConsent: true,
    }, deps)).rejects.toMatchObject({ code: "SECURITY_RETEST_FORBIDDEN" });
  });

  it("allows members to request passive retests and derives the immutable snapshot", async () => {
    const deps = dependencies();
    await requestFindingRetest({
      actorId: "user-1",
      workspaceId: "workspace-1",
      role: "member",
      findingId: "finding-1",
      explicitConsent: true,
    }, deps);

    expect(deps.repository.requestFindingRetest).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      findingId: "finding-1",
      actorId: "user-1",
      executionKind: "passive_runtime",
      sourceId: "scopeforge:runtime-observer",
      sourceVersion: "0.1.0",
      ruleRef: "runtime:test",
      validationProfileId: null,
      validationProfileVersion: null,
      explicitConsent: false,
    });
  });

  it.each(["owner", "admin"] as const)("allows %s to request active CORS retests with consent", async (role) => {
    const activeFinding = finding({
      source_id: "scopeforge:runtime-validator",
      source_version: "cors-origin-policy@1",
      rule_ref: "cors-origin-policy@1:cors-untrusted-origin-allowed",
      validation_state: "runtime_validated",
    });
    const deps = dependencies(activeFinding);
    await requestFindingRetest({
      actorId: "user-1",
      workspaceId: "workspace-1",
      role,
      findingId: "finding-1",
      explicitConsent: true,
    }, deps);

    expect(deps.repository.requestFindingRetest).toHaveBeenCalledWith(expect.objectContaining({
      executionKind: "active_validation",
      sourceId: "scopeforge:runtime-validator",
      sourceVersion: "cors-origin-policy@1",
      ruleRef: activeFinding.rule_ref,
      validationProfileId: "cors-origin-policy",
      validationProfileVersion: 1,
      explicitConsent: true,
    }));
  });

  it("rejects viewers before the request transaction", async () => {
    const deps = dependencies();
    await expect(requestFindingRetest({
      actorId: "user-1",
      workspaceId: "workspace-1",
      role: "viewer",
      findingId: "finding-1",
      explicitConsent: false,
    }, deps)).rejects.toMatchObject({ code: "SECURITY_RETEST_FORBIDDEN" });
    expect(deps.repository.requestFindingRetest).not.toHaveBeenCalled();
  });
});
