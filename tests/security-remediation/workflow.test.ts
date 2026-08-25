import { describe, expect, it, vi } from "vitest";
import type {
  SecurityFindingRow,
  SecurityFindingWorkRow,
} from "@/lib/database.types";
import {
  SecurityRemediationWorkflowError,
  updateFindingWork,
} from "@/lib/security-remediation/service";

const finding: SecurityFindingRow = {
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
  lifecycle_state: "in_progress",
  first_seen_at: "2026-08-25T00:00:00.000Z",
  last_seen_at: "2026-08-25T00:00:00.000Z",
  last_seen_job_id: "job-1",
  created_at: "2026-08-25T00:00:00.000Z",
  updated_at: "2026-08-25T00:00:00.000Z",
};

const work: SecurityFindingWorkRow = {
  workspace_id: "workspace-1",
  finding_id: "finding-1",
  assignee_user_id: "user-1",
  remediation_note: "Rotate the affected policy.",
  updated_by: "user-1",
  created_at: "2026-08-25T00:00:00.000Z",
  updated_at: "2026-08-25T00:00:00.000Z",
};

function dependencies(overrides: { finding?: SecurityFindingRow | null } = {}) {
  const repository = {
    loadFinding: vi.fn(async () => overrides.finding === undefined ? finding : overrides.finding),
    changeFindingWork: vi.fn(async () => work),
  };
  return { repository };
}

describe("updateFindingWork", () => {
  it("rejects viewers with a stable safe error", async () => {
    const deps = dependencies();
    await expect(updateFindingWork({
      actorId: "user-1",
      workspaceId: "workspace-1",
      role: "viewer",
      findingId: "finding-1",
      assigneeUserId: "user-1",
      remediationNote: null,
    }, deps)).rejects.toMatchObject({
      name: "SecurityRemediationWorkflowError",
      code: "SECURITY_REMEDIATION_FORBIDDEN",
    });
    expect(deps.repository.changeFindingWork).not.toHaveBeenCalled();
  });

  it("allows a member to self-assign", async () => {
    const deps = dependencies();
    await updateFindingWork({
      actorId: "user-1",
      workspaceId: "workspace-1",
      role: "member",
      findingId: "finding-1",
      assigneeUserId: "user-1",
      remediationNote: "  Rotate the affected policy.  ",
    }, deps);

    expect(deps.repository.changeFindingWork).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      findingId: "finding-1",
      actorId: "user-1",
      assigneeUserId: "user-1",
      remediationNote: "Rotate the affected policy.",
    });
  });

  it("does not allow a member to assign another user", async () => {
    const deps = dependencies();
    await expect(updateFindingWork({
      actorId: "user-1",
      workspaceId: "workspace-1",
      role: "member",
      findingId: "finding-1",
      assigneeUserId: "user-2",
      remediationNote: null,
    }, deps)).rejects.toBeInstanceOf(SecurityRemediationWorkflowError);
    expect(deps.repository.changeFindingWork).not.toHaveBeenCalled();
  });

  it.each(["owner", "admin"] as const)("allows %s to delegate to another workspace member", async (role) => {
    const deps = dependencies();
    await updateFindingWork({
      actorId: "user-1",
      workspaceId: "workspace-1",
      role,
      findingId: "finding-1",
      assigneeUserId: "user-2",
      remediationNote: null,
    }, deps);
    expect(deps.repository.changeFindingWork).toHaveBeenCalled();
  });

  it("rejects remediation notes longer than 2000 characters before mutation", async () => {
    const deps = dependencies();
    await expect(updateFindingWork({
      actorId: "user-1",
      workspaceId: "workspace-1",
      role: "owner",
      findingId: "finding-1",
      assigneeUserId: null,
      remediationNote: "x".repeat(2001),
    }, deps)).rejects.toMatchObject({ code: "SECURITY_REMEDIATION_NOTE_INVALID" });
    expect(deps.repository.changeFindingWork).not.toHaveBeenCalled();
  });

  it("rejects unavailable findings without leaking repository details", async () => {
    const deps = dependencies({ finding: null });
    await expect(updateFindingWork({
      actorId: "user-1",
      workspaceId: "workspace-1",
      role: "owner",
      findingId: "missing",
      assigneeUserId: null,
      remediationNote: null,
    }, deps)).rejects.toMatchObject({
      code: "SECURITY_REMEDIATION_FINDING_NOT_AVAILABLE",
      reason: "The security finding is not available in this workspace.",
    });
  });
});
