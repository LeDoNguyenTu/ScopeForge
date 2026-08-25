import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/database.types";
import { createSecurityFindingRepository } from "@/lib/security-findings/repository";

type FindingRow = Database["public"]["Tables"]["security_findings"]["Row"];

const finding: FindingRow = {
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
  lifecycle_state: "open",
  first_seen_at: "2026-08-25T00:00:00.000Z",
  last_seen_at: "2026-08-25T00:00:00.000Z",
  last_seen_job_id: "job-1",
  created_at: "2026-08-25T00:00:00.000Z",
  updated_at: "2026-08-25T00:00:00.000Z",
};

describe("security finding lifecycle repository", () => {
  it("uses only the narrow lifecycle RPC for mutations", async () => {
    const rpc = vi.fn(async () => ({ data: finding, error: null }));
    const admin = { rpc } as never;
    const repository = createSecurityFindingRepository(admin);

    const result = await repository.changeLifecycle({
      workspaceId: "workspace-1",
      findingId: "finding-1",
      expectedLifecycle: "open",
      nextLifecycle: "acknowledged",
      actorId: "user-1",
      reason: null,
    });

    expect(result.lifecycle_state).toBe("open");
    expect(rpc).toHaveBeenCalledWith("change_security_finding_lifecycle", {
      target_workspace_id: "workspace-1",
      target_finding_id: "finding-1",
      expected_lifecycle: "open",
      next_lifecycle: "acknowledged",
      target_actor_id: "user-1",
      event_reason: null,
    });
  });
});
