import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { SecurityFindingRetestRow } from "@/lib/database.types";
import { executeFindingRetestWithRecovery } from "@/lib/security-remediation/execution";

const hardeningMigrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260825091000_phase_5b_retest_recovery_hardening.sql",
);

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

describe("Phase 5B retest recovery", () => {
  it("enforces the exact closed runtime source registry at the database row boundary", async () => {
    const sql = await readFile(hardeningMigrationPath, "utf8");
    expect(sql).toContain("security_finding_retests_source_snapshot_check");
    expect(sql).toMatch(/execution_kind = 'passive_runtime'[\s\S]*source_id = 'scopeforge:runtime-observer'[\s\S]*source_version is not distinct from '0\.1'/i);
    expect(sql).toMatch(/execution_kind = 'active_validation'[\s\S]*source_id = 'scopeforge:runtime-validator'[\s\S]*source_version is not distinct from 'cors-origin-policy@1'/i);
  });

  it("returns terminal non-verified retests to in-progress when the finding is still retest-pending", async () => {
    const sql = await readFile(hardeningMigrationPath, "utf8");
    expect(sql).toContain("recover_security_finding_after_unverified_retest");
    expect(sql).toMatch(/new\.status in \('still_present', 'inconclusive', 'failed', 'cancelled'\)/i);
    expect(sql).toMatch(/lifecycle_state = 'in_progress'[\s\S]*lifecycle_state = 'retest_pending'/i);
    expect(sql).toContain("'finding.lifecycle_changed'");
    expect(sql).toContain("'retest_pending'");
    expect(sql).toContain("'in_progress'");
  });

  it("provides a service-role-only pre-start abort transaction", async () => {
    const sql = await readFile(hardeningMigrationPath, "utf8");
    expect(sql).toContain("create or replace function public.abort_security_finding_retest_before_start");
    expect(sql).toMatch(/abort_security_finding_retest_before_start[\s\S]*security definer[\s\S]*set search_path = ''/i);
    expect(sql).toMatch(/status = 'failed'[\s\S]*result_code = 'enqueue_failed'[\s\S]*completed_at = now\(\)/i);
    expect(sql).toMatch(/revoke all on function public\.abort_security_finding_retest_before_start[\s\S]*from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.abort_security_finding_retest_before_start[\s\S]*to service_role/i);
  });

  it("compensates an enqueue failure and returns only a stable workflow error", async () => {
    const abortRetestBeforeStart = vi.fn(async () => retest({
      status: "failed",
      result_code: "enqueue_failed",
      completed_at: "2026-08-25T00:01:00.000Z",
    }));
    const execute = vi.fn(async () => {
      throw new Error("upstream detail that must not escape");
    });

    await expect(executeFindingRetestWithRecovery({
      actorId: "user-1",
      workspaceId: "workspace-1",
      role: "member",
      retest: retest(),
    }, {
      execute,
      abortRetestBeforeStart,
    })).rejects.toMatchObject({
      code: "SECURITY_RETEST_EXECUTION_FAILED",
    });

    expect(abortRetestBeforeStart).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      retestId: "retest-1",
      actorId: "user-1",
    });
  });
});
