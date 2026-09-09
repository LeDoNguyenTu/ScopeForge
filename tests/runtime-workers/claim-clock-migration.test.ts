import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260831011000_phase_6d_runtime_worker_claim_clock.sql",
);

describe("Phase 6D runtime worker claim clock hardening", () => {
  it("samples candidate time only after the claim lock and worker row lock", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const advisory = sql.indexOf(
      "pg_advisory_xact_lock(hashtextextended('scopeforge-runtime-worker-claim-v1', 0))",
    );
    const workerLock = sql.indexOf("from private.worker_nodes");
    const selectionClock = sql.indexOf("selection_now := clock_timestamp();");
    const candidateDeadline = sql.indexOf("t.absolute_deadline_at > selection_now");

    expect(advisory).toBeGreaterThan(-1);
    expect(workerLock).toBeGreaterThan(advisory);
    expect(selectionClock).toBeGreaterThan(workerLock);
    expect(candidateDeadline).toBeGreaterThan(selectionClock);
  });

  it("resamples wall time after the domain job lock before creating a lease", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const jobLock = sql.indexOf("from public.scan_jobs", sql.indexOf("select * into job_record"));
    const claimClock = sql.indexOf("claim_now := clock_timestamp();");
    const expiryCheck = sql.indexOf("task_record.absolute_deadline_at <= claim_now");
    const leaseInsert = sql.indexOf("insert into private.worker_attempts");

    expect(jobLock).toBeGreaterThan(-1);
    expect(claimClock).toBeGreaterThan(jobLock);
    expect(expiryCheck).toBeGreaterThan(claimClock);
    expect(leaseInsert).toBeGreaterThan(expiryCheck);
  });

  it("binds the queued-to-leased update to the fresh deadline", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("and absolute_deadline_at > claim_now");
    expect(sql).not.toContain("claim_now timestamptz := now()");
  });

  it("keeps the replacement RPC search-path hardened and service-role only", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql.match(/security definer/g)?.length).toBe(1);
    expect(sql.match(/set search_path = ''/g)?.length).toBe(1);
    expect(sql).toContain("revoke all on function public.claim_runtime_worker_task(uuid)");
    expect(sql).toContain("grant execute on function public.claim_runtime_worker_task(uuid)");
    expect(sql).toContain("to service_role");
    expect(sql).not.toMatch(/to\s+(anon|authenticated)/i);
  });
});
