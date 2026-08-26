import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260826110700_phase_6a_worker_job_contract.sql",
);

describe("Phase 6A worker foundation scan job contract", () => {
  it("pins the internal job to the closed no-egress budget and zero-observation shape", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("scan_jobs_worker_foundation_probe_snapshot_check");
    expect(sql).toContain("job_kind <> 'worker_foundation_probe'::public.scan_job_kind");
    expect(sql).toContain('"maxWallTimeMs":30000');
    expect(sql).toContain('"maxCpuTimeMs":20000');
    expect(sql).toContain('"maxMemoryBytes":268435456');
    expect(sql).toContain('"maxProcesses":4');
    expect(sql).toContain("request_count = 0");
    expect(sql).toContain("redirect_count = 0");
    expect(sql).toContain("finding_count = 0");
  });

  it("forbids runtime authorization snapshots and blocked worker-probe jobs", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("authorization_canonical_target is null");
    expect(sql).toContain("authorization_asset_kind is null");
    expect(sql).toContain("authorization_verified_at is null");
    expect(sql).toContain("validation_profile_id is null");
    expect(sql).toContain("authorization_granted_at is null");
    expect(sql).toContain("status <> 'blocked'::public.scan_job_status");
  });
});
