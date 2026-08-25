import { describe, expect, it, vi } from "vitest";
import type { SecurityFindingRetestRow } from "@/lib/database.types";
import {
  finalizeRetest,
  markRetestRunning,
} from "@/lib/security-remediation/service";

const requestedRetest: SecurityFindingRetestRow = {
  id: "retest-1",
  workspace_id: "workspace-1",
  finding_id: "finding-1",
  asset_id: "asset-1",
  requested_by: "user-1",
  execution_kind: "passive_runtime",
  source_id: "scopeforge:runtime-observer",
  source_version: "0.1",
  rule_ref: "runtime-rule:missing-security-headers@0.1",
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

const runningRetest: SecurityFindingRetestRow = {
  ...requestedRetest,
  status: "running",
  scan_job_id: "job-2",
  started_at: "2026-08-25T00:01:00.000Z",
};

const verifiedRetest: SecurityFindingRetestRow = {
  ...runningRetest,
  status: "verified_fixed",
  result_code: "verified_fixed",
  completed_at: "2026-08-25T00:02:00.000Z",
};

describe("retest finalization service boundary", () => {
  it("attaches only the server-selected job identifier", async () => {
    const repository = {
      markRetestRunning: vi.fn(async () => runningRetest),
    };

    const result = await markRetestRunning({
      workspaceId: "workspace-1",
      retestId: "retest-1",
      scanJobId: "job-2",
      actorId: "user-1",
    }, { repository });

    expect(result).toEqual(runningRetest);
    expect(repository.markRetestRunning).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      retestId: "retest-1",
      scanJobId: "job-2",
      actorId: "user-1",
    });
  });

  it("asks the database to derive final status without caller-selected outcome", async () => {
    const repository = {
      finalizeRetest: vi.fn(async () => verifiedRetest),
    };

    const result = await finalizeRetest({
      workspaceId: "workspace-1",
      retestId: "retest-1",
    }, { repository });

    expect(result).toEqual(verifiedRetest);
    expect(repository.finalizeRetest).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      retestId: "retest-1",
    });
    expect(repository.finalizeRetest.mock.calls[0]?.[0]).not.toHaveProperty("status");
    expect(repository.finalizeRetest.mock.calls[0]?.[0]).not.toHaveProperty("resultCode");
  });
});
