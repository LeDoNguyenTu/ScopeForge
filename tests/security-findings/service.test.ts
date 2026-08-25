import { describe, expect, it, vi } from "vitest";
import type { Database, FindingLifecycleState } from "@/lib/database.types";
import {
  changeFindingLifecycle,
  FindingLifecycleWorkflowError,
  type FindingLifecycleServiceDependencies,
} from "@/lib/security-findings/service";

type FindingRow = Database["public"]["Tables"]["security_findings"]["Row"];

function finding(lifecycle: FindingLifecycleState): FindingRow {
  return {
    workspace_id: "workspace-1",
    finding_id: "finding-1",
    asset_id: "asset-1",
    source_kind: "deterministic-runtime-scanner",
    source_id: "scopeforge:runtime-observer",
    source_version: "0.1",
    rule_ref: "runtime-rule:missing-hsts@0.1",
    title: "Missing HSTS",
    description: "Strict transport security was not observed.",
    severity: "medium",
    confidence: "high",
    validation_state: "runtime_observed",
    provenance_kind: "scanner-derived",
    location: null,
    taxonomy: {},
    remediation: null,
    lifecycle_state: lifecycle,
    first_seen_at: "2026-08-25T00:00:00.000Z",
    last_seen_at: "2026-08-25T00:00:00.000Z",
    last_seen_job_id: "job-1",
    created_at: "2026-08-25T00:00:00.000Z",
    updated_at: "2026-08-25T00:00:00.000Z",
  };
}

function dependencies(lifecycle: FindingLifecycleState): FindingLifecycleServiceDependencies {
  const current = finding(lifecycle);
  return {
    repository: {
      loadFinding: vi.fn(async () => current),
      changeLifecycle: vi.fn(async (input) => finding(input.nextLifecycle)),
    } as never,
  };
}

describe("trusted finding lifecycle service", () => {
  it("rejects viewers before any mutation", async () => {
    const deps = dependencies("open");

    await expect(changeFindingLifecycle({
      actorId: "viewer-1",
      workspaceId: "workspace-1",
      role: "viewer",
      findingId: "finding-1",
      action: "acknowledge",
    }, deps)).rejects.toMatchObject({ code: "FINDING_LIFECYCLE_FORBIDDEN" });

    expect(deps.repository.changeLifecycle).not.toHaveBeenCalled();
  });

  it("maps the exact Phase 5A ordinary actions without accepting a generic target state", async () => {
    const deps = dependencies("open");

    const updated = await changeFindingLifecycle({
      actorId: "member-1",
      workspaceId: "workspace-1",
      role: "member",
      findingId: "finding-1",
      action: "acknowledge",
    }, deps);

    expect(updated.lifecycle_state).toBe("acknowledged");
    expect(deps.repository.changeLifecycle).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      findingId: "finding-1",
      expectedLifecycle: "open",
      nextLifecycle: "acknowledged",
      actorId: "member-1",
      reason: null,
    });
  });

  it.each([
    ["resolve", "in_progress", "resolved"],
    ["reopen", "resolved", "in_progress"],
  ] as const)("requires a bounded note for %s", async (action, lifecycle, target) => {
    const deps = dependencies(lifecycle);

    await expect(changeFindingLifecycle({
      actorId: "admin-1",
      workspaceId: "workspace-1",
      role: "admin",
      findingId: "finding-1",
      action,
      note: "   ",
    }, deps)).rejects.toBeInstanceOf(FindingLifecycleWorkflowError);

    const updated = await changeFindingLifecycle({
      actorId: "admin-1",
      workspaceId: "workspace-1",
      role: "admin",
      findingId: "finding-1",
      action,
      note: "Reviewed and confirmed by the operator.",
    }, deps);

    expect(updated.lifecycle_state).toBe(target);
    expect(deps.repository.changeLifecycle).toHaveBeenLastCalledWith(expect.objectContaining({
      expectedLifecycle: lifecycle,
      nextLifecycle: target,
      reason: "Reviewed and confirmed by the operator.",
    }));
  });

  it("rejects notes longer than the database event bound", async () => {
    const deps = dependencies("in_progress");

    await expect(changeFindingLifecycle({
      actorId: "owner-1",
      workspaceId: "workspace-1",
      role: "owner",
      findingId: "finding-1",
      action: "resolve",
      note: "x".repeat(1001),
    }, deps)).rejects.toMatchObject({ code: "FINDING_LIFECYCLE_NOTE_INVALID" });
  });
});
