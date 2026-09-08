import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260831010800_worker_heartbeat_recovery_lock.sql",
);

describe("worker heartbeat recovery-lock hardening migration", () => {
  it("serializes heartbeat with leased recovery before worker/task/attempt row locks", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const advisoryLock = sql.indexOf("pg_advisory_xact_lock(hashtextextended('scopeforge-worker-recovery-v1', 0))");
    const workerLock = sql.indexOf("from private.worker_nodes");
    const taskLock = sql.indexOf("from private.worker_tasks");
    const attemptLock = sql.indexOf("from private.worker_attempts");

    expect(advisoryLock).toBeGreaterThan(-1);
    expect(advisoryLock).toBeLessThan(workerLock);
    expect(workerLock).toBeLessThan(taskLock);
    expect(taskLock).toBeLessThan(attemptLock);
  });

  it("samples real wall-clock time only after the domain job lock", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("heartbeat_now timestamptz;");
    expect(sql).not.toContain("heartbeat_now timestamptz := now()");
    expect(sql).toContain("heartbeat_now := clock_timestamp();");

    const jobLock = sql.indexOf("from public.scan_jobs");
    const clockSample = sql.indexOf("heartbeat_now := clock_timestamp();");
    const leaseCheck = sql.indexOf("attempt_record.lease_expires_at <= heartbeat_now");
    expect(clockSample).toBeGreaterThan(jobLock);
    expect(leaseCheck).toBeGreaterThan(clockSample);
  });

  it("preserves cancellation and bounded lease-extension semantics", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("cancellation_requested := job_record.cancel_requested_at is not null");
    expect(sql).toContain("or job_record.status = 'cancelled'::public.scan_job_status");
    expect(sql).toContain("next_expiry := attempt_record.lease_expires_at");
    expect(sql).toContain("heartbeat_now + interval '90 seconds'");
    expect(sql).toContain("task_record.absolute_deadline_at");
  });

  it("keeps heartbeat service-role only and search-path hardened", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql.match(/security definer/g)?.length).toBe(1);
    expect(sql.match(/set search_path = ''/g)?.length).toBe(1);
    expect(sql).toContain("revoke all on function public.heartbeat_worker_attempt");
    expect(sql).toContain("grant execute on function public.heartbeat_worker_attempt");
    expect(sql).toContain("to service_role");
    expect(sql).not.toMatch(/to\s+(anon|authenticated)/i);
  });
});
