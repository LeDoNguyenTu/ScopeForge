import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260831010600_phase_6d_runtime_worker_preparation_commit.sql",
);

describe("Phase 6D atomic preparation commit migration", () => {
  it("keeps the commit RPC service-role only and search-path hardened", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql.match(/security definer/g)?.length).toBe(1);
    expect(sql.match(/set search_path = ''/g)?.length).toBe(1);
    expect(sql).toContain("revoke all on function public.commit_runtime_worker_preparation");
    expect(sql).toContain("grant execute on function public.commit_runtime_worker_preparation");
    expect(sql).toContain("to service_role");
    expect(sql).not.toMatch(/to\s+(anon|authenticated)/i);
  });

  it("relocks worker, task, attempt, domain job, and asset in a deadlock-safe order", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("from private.worker_nodes");
    expect(sql).toContain("from private.worker_tasks");
    expect(sql).toContain("from private.worker_attempts");
    expect(sql).toContain("from private.runtime_worker_tasks");
    expect(sql).toContain("from public.scan_jobs");
    expect(sql).toContain("from public.assets");
    expect(sql.match(/for update/g)?.length).toBeGreaterThanOrEqual(5);

    const workerLock = sql.indexOf("from private.worker_nodes");
    const taskLock = sql.indexOf("from private.worker_tasks");
    const attemptLock = sql.indexOf("from private.worker_attempts");
    const jobLock = sql.indexOf("from public.scan_jobs");
    const assetLock = sql.indexOf("from public.assets");
    expect(workerLock).toBeGreaterThan(-1);
    expect(workerLock).toBeLessThan(taskLock);
    expect(taskLock).toBeLessThan(attemptLock);
    expect(attemptLock).toBeLessThan(jobLock);
    expect(jobLock).toBeLessThan(assetLock);

    expect(sql).toContain("attempt_record.lease_expires_at <= commit_now");
    expect(sql).toContain("task_record.absolute_deadline_at <= commit_now");
    expect(sql).toContain("task_record.max_attempts <> 1");
    expect(sql).toContain("attempt_record.finished_at is not null");
  });

  it("samples real wall-clock time only after every potentially blocking authorization row lock", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("commit_now timestamptz;");
    expect(sql).not.toContain("commit_now timestamptz := now()");
    expect(sql).toContain("commit_now := clock_timestamp();");

    const assetLock = sql.indexOf("from public.assets");
    const clockSample = sql.indexOf("commit_now := clock_timestamp();");
    const deadlineCheck = sql.indexOf("task_record.absolute_deadline_at <= commit_now");
    const leaseCheck = sql.indexOf("attempt_record.lease_expires_at <= commit_now");
    expect(clockSample).toBeGreaterThan(assetLock);
    expect(deadlineCheck).toBeGreaterThan(clockSample);
    expect(leaseCheck).toBeGreaterThan(clockSample);
  });

  it("binds the locked attempt to the task's sole attempt number", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("task_record.attempt_count <> 1");
    expect(sql).toContain("task_record.max_attempts <> 1");
    expect(sql).toContain("attempt_record.attempt_number <> task_record.attempt_count");
  });

  it("compares the exact reauthorized asset and job snapshot before execution starts", async () => {
    const sql = await readFile(migrationPath, "utf8");
    for (const field of [
      "target_expected_asset_canonical_target",
      "target_expected_asset_kind",
      "target_expected_asset_hostname",
      "target_expected_asset_verified_at",
      "target_expected_job_authorization_canonical_target",
      "target_expected_job_authorization_asset_kind",
      "target_expected_job_authorization_verified_at",
      "target_expected_job_validation_profile_id",
      "target_expected_job_validation_profile_version",
      "target_expected_job_authorization_granted_at",
      "target_expected_job_budget",
    ]) {
      expect(sql).toContain(field);
    }
    expect(sql).toContain("asset_record.verification_status::text <> 'verified'");
    expect(sql).toContain("job_record.cancel_requested_at is not null");
    expect(sql).toContain("job_record.budget is distinct from target_expected_job_budget");
  });

  it("performs the queued-to-running transition only after all checks and returns no target authority", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/update public\.scan_jobs[\s\S]*set status = 'running'::public\.scan_job_status[\s\S]*and status = 'queued'::public\.scan_job_status[\s\S]*and cancel_requested_at is null/i);
    expect(sql).toContain("'status', 'running'");
    expect(sql).not.toContain("'canonicalTarget'");
    expect(sql).not.toContain("'hostname'");
    expect(sql).not.toContain("'leaseToken'");
  });
});
