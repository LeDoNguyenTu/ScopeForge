import { describe, expect, it, vi } from "vitest";
import type {
  SecurityFindingRow,
  SecurityFindingWorkRow,
} from "@/lib/database.types";
import { createSecurityRemediationRepository } from "@/lib/security-remediation/repository";
import { SecurityRemediationWorkflowError } from "@/lib/security-remediation/types";

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
  assignee_user_id: "user-2",
  remediation_note: "Rotate the affected policy.",
  updated_by: "user-1",
  created_at: "2026-08-25T00:00:00.000Z",
  updated_at: "2026-08-25T00:00:00.000Z",
};

describe("security remediation repository", () => {
  it("uses only the narrow remediation work RPC for mutations", async () => {
    const rpc = vi.fn(async () => ({ data: work, error: null }));
    const repository = createSecurityRemediationRepository({ rpc } as never);

    const result = await repository.changeFindingWork({
      workspaceId: "workspace-1",
      findingId: "finding-1",
      actorId: "user-1",
      assigneeUserId: "user-2",
      remediationNote: "Rotate the affected policy.",
    });

    expect(result).toEqual(work);
    expect(rpc).toHaveBeenCalledWith("change_security_finding_work", {
      target_workspace_id: "workspace-1",
      target_finding_id: "finding-1",
      target_actor_id: "user-1",
      target_assignee_user_id: "user-2",
      target_remediation_note: "Rotate the affected policy.",
    });
  });

  it("maps trusted database policy codes to stable workflow errors", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: "SECURITY_REMEDIATION_ASSIGNEE_INVALID: internal detail" },
    }));
    const repository = createSecurityRemediationRepository({ rpc } as never);

    await expect(repository.changeFindingWork({
      workspaceId: "workspace-1",
      findingId: "finding-1",
      actorId: "user-1",
      assigneeUserId: "user-3",
      remediationNote: null,
    })).rejects.toMatchObject({
      name: "SecurityRemediationWorkflowError",
      code: "SECURITY_REMEDIATION_ASSIGNEE_INVALID",
      reason: "The selected assignee is not available for this workspace.",
    });
  });

  it("does not expose unknown database error text", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: "password=secret unexpected postgres text" },
    }));
    const repository = createSecurityRemediationRepository({ rpc } as never);

    await expect(repository.changeFindingWork({
      workspaceId: "workspace-1",
      findingId: "finding-1",
      actorId: "user-1",
      assigneeUserId: null,
      remediationNote: null,
    })).rejects.toThrow("Unable to change finding remediation work.");
  });

  it("loads the canonical finding through the workspace-scoped finding table", async () => {
    const maybeSingle = vi.fn(async () => ({ data: finding, error: null }));
    const eqFinding = vi.fn(() => ({ maybeSingle }));
    const eqWorkspace = vi.fn(() => ({ eq: eqFinding }));
    const select = vi.fn(() => ({ eq: eqWorkspace }));
    const from = vi.fn(() => ({ select }));
    const repository = createSecurityRemediationRepository({ from, rpc: vi.fn() } as never);

    await expect(repository.loadFinding("workspace-1", "finding-1")).resolves.toEqual(finding);
    expect(from).toHaveBeenCalledWith("security_findings");
  });
});
