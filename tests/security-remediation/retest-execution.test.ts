import { describe, expect, it, vi } from "vitest";
import type {
  ScanJobStatus,
  SecurityFindingRetestRow,
  SecurityFindingRetestStatus,
} from "@/lib/database.types";
import { executeFindingRetest } from "@/lib/security-remediation/service";
import type { RuntimeObservationServiceDependencies } from "@/lib/runtime-observations/service";
import type { ActiveValidationServiceDependencies } from "@/lib/active-validation/service";
import { RUNTIME_OBSERVATION_MAX_BUDGET } from "@/packages/runtime-observer";
import { ACTIVE_VALIDATION_MAX_BUDGET } from "@/packages/runtime-validator";

function retest(overrides: Partial<SecurityFindingRetestRow> = {}): SecurityFindingRetestRow {
  return {
    id: "retest-1",
    workspace_id: "workspace-1",
    finding_id: "finding-1",
    asset_id: "asset-1",
    requested_by: "user-1",
    execution_kind: "passive_runtime",
    source_id: "scopeforge:runtime-observer",
    source_version: "0.1",
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
    ...overrides,
  };
}

function retestWithStatus(
  base: SecurityFindingRetestRow,
  status: SecurityFindingRetestStatus,
): SecurityFindingRetestRow {
  return { ...base, status };
}

function scanJob(input: {
  id: string;
  kind: "passive_runtime" | "active_validation";
  status?: ScanJobStatus;
}) {
  return {
    id: input.id,
    workspace_id: "workspace-1",
    asset_id: "asset-1",
    job_kind: input.kind,
    status: input.status ?? "queued",
    requested_by: "user-1",
    blocked_reason: null,
    authorization_canonical_target: "https://example.com",
    authorization_asset_kind: "web_application" as const,
    authorization_verified_at: "2026-08-25T00:00:00.000Z",
    validation_profile_id: input.kind === "active_validation" ? "cors-origin-policy" : null,
    validation_profile_version: input.kind === "active_validation" ? 1 : null,
    authorization_granted_at: input.kind === "active_validation" ? "2026-08-25T00:01:00.000Z" : null,
    budget: {},
    cancel_requested_at: null,
    started_at: null,
    finished_at: null,
    failure_code: null,
    request_count: 0,
    redirect_count: 0,
    finding_count: 0,
    created_at: "2026-08-25T00:01:00.000Z",
  };
}

const runtimeDependencies = {} as RuntimeObservationServiceDependencies;
const activeDependencies = {} as ActiveValidationServiceDependencies;

describe("executeFindingRetest", () => {
  it("uses only the passive executor with the fixed budget and ordered attachment/finalization", async () => {
    const order: string[] = [];
    const requested = retest();
    const queuedJob = scanJob({ id: "passive-job", kind: "passive_runtime" });
    const running = retestWithStatus({
      ...requested,
      scan_job_id: queuedJob.id,
      started_at: "2026-08-25T00:02:00.000Z",
    }, "running");
    const terminal = retestWithStatus({
      ...running,
      result_code: "verified_fixed",
      completed_at: "2026-08-25T00:03:00.000Z",
    }, "verified_fixed");

    const enqueueRuntime = vi.fn(async (input: unknown) => {
      order.push("enqueue-passive");
      expect(input).toMatchObject({
        actorId: "user-1",
        workspaceId: "workspace-1",
        role: "member",
        assetId: "asset-1",
        budget: RUNTIME_OBSERVATION_MAX_BUDGET,
      });
      return { job: queuedJob, target: {} };
    });
    const executeRuntime = vi.fn(async (jobId: string) => {
      order.push("execute-passive");
      expect(jobId).toBe(queuedJob.id);
      return { status: "succeeded", job: { ...queuedJob, status: "succeeded" } };
    });
    const enqueueActive = vi.fn();
    const executeActive = vi.fn();
    const repository = {
      markRetestRunning: vi.fn(async (input: unknown) => {
        order.push("mark-running");
        expect(input).toEqual({
          workspaceId: "workspace-1",
          retestId: "retest-1",
          scanJobId: queuedJob.id,
          actorId: "user-1",
        });
        return running;
      }),
      finalizeRetest: vi.fn(async (input: unknown) => {
        order.push("finalize");
        expect(input).toEqual({ workspaceId: "workspace-1", retestId: "retest-1" });
        return terminal;
      }),
    };

    const result = await executeFindingRetest({
      actorId: "user-1",
      workspaceId: "workspace-1",
      role: "member",
      retest: requested,
    }, {
      repository,
      runtimeDependencies,
      activeDependencies,
      enqueueRuntimeObservation: enqueueRuntime,
      executeRuntimeObservation: executeRuntime,
      enqueueActiveValidation: enqueueActive,
      executeActiveValidation: executeActive,
    });

    expect(result).toEqual(terminal);
    expect(order).toEqual(["enqueue-passive", "mark-running", "execute-passive", "finalize"]);
    expect(enqueueActive).not.toHaveBeenCalled();
    expect(executeActive).not.toHaveBeenCalled();
  });

  it("uses only active CORS validation and derives explicit consent from the persisted retest snapshot", async () => {
    const order: string[] = [];
    const requested = retest({
      execution_kind: "active_validation",
      source_id: "scopeforge:runtime-validator",
      source_version: "cors-origin-policy@1",
      rule_ref: "cors-origin-policy@1:cors-untrusted-origin-allowed",
      validation_profile_id: "cors-origin-policy",
      validation_profile_version: 1,
      active_consent_granted_at: "2026-08-25T00:01:00.000Z",
    });
    const queuedJob = scanJob({ id: "active-job", kind: "active_validation" });
    const running = retestWithStatus({
      ...requested,
      scan_job_id: queuedJob.id,
      started_at: "2026-08-25T00:02:00.000Z",
    }, "running");
    const terminal = retestWithStatus({
      ...running,
      result_code: "still_present",
      completed_at: "2026-08-25T00:03:00.000Z",
    }, "still_present");

    const enqueueRuntime = vi.fn();
    const executeRuntime = vi.fn();
    const enqueueActive = vi.fn(async (input: unknown) => {
      order.push("enqueue-active");
      expect(input).toMatchObject({
        actorId: "user-1",
        workspaceId: "workspace-1",
        role: "owner",
        assetId: "asset-1",
        explicitConsent: true,
        budget: ACTIVE_VALIDATION_MAX_BUDGET,
      });
      return { job: queuedJob, target: {} };
    });
    const executeActive = vi.fn(async (jobId: string) => {
      order.push("execute-active");
      expect(jobId).toBe(queuedJob.id);
      return { status: "succeeded", job: { ...queuedJob, status: "succeeded" } };
    });
    const repository = {
      markRetestRunning: vi.fn(async () => {
        order.push("mark-running");
        return running;
      }),
      finalizeRetest: vi.fn(async () => {
        order.push("finalize");
        return terminal;
      }),
    };

    const result = await executeFindingRetest({
      actorId: "user-1",
      workspaceId: "workspace-1",
      role: "owner",
      retest: requested,
    }, {
      repository,
      runtimeDependencies,
      activeDependencies,
      enqueueRuntimeObservation: enqueueRuntime,
      executeRuntimeObservation: executeRuntime,
      enqueueActiveValidation: enqueueActive,
      executeActiveValidation: executeActive,
    });

    expect(result).toEqual(terminal);
    expect(order).toEqual(["enqueue-active", "mark-running", "execute-active", "finalize"]);
    expect(enqueueRuntime).not.toHaveBeenCalled();
    expect(executeRuntime).not.toHaveBeenCalled();
  });

  it("rejects an active retest without persisted consent before invoking either executor", async () => {
    const requested = retest({
      execution_kind: "active_validation",
      source_id: "scopeforge:runtime-validator",
      source_version: "cors-origin-policy@1",
      rule_ref: "cors-origin-policy@1:cors-untrusted-origin-allowed",
      validation_profile_id: "cors-origin-policy",
      validation_profile_version: 1,
      active_consent_granted_at: null,
    });
    const enqueueRuntime = vi.fn();
    const enqueueActive = vi.fn();

    await expect(executeFindingRetest({
      actorId: "user-1",
      workspaceId: "workspace-1",
      role: "owner",
      retest: requested,
    }, {
      repository: {
        markRetestRunning: vi.fn(),
        finalizeRetest: vi.fn(),
      },
      runtimeDependencies,
      activeDependencies,
      enqueueRuntimeObservation: enqueueRuntime,
      executeRuntimeObservation: vi.fn(),
      enqueueActiveValidation: enqueueActive,
      executeActiveValidation: vi.fn(),
    })).rejects.toMatchObject({ code: "SECURITY_RETEST_CONSENT_REQUIRED" });

    expect(enqueueRuntime).not.toHaveBeenCalled();
    expect(enqueueActive).not.toHaveBeenCalled();
  });
});
