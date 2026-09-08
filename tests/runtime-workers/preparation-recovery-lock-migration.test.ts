import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260831010700_phase_6d_runtime_worker_preparation_recovery_lock.sql",
);

describe("Phase 6D preparation/recovery lock hardening migration", () => {
  it("serializes preparation against generic leased recovery before taking row locks", async () => {
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

  it("preserves real-time lease checks after all authorization row locks", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const assetLock = sql.indexOf("from public.assets");
    const clockSample = sql.indexOf("commit_now := clock_timestamp();");
    const deadlineCheck = sql.indexOf("task_record.absolute_deadline_at <= commit_now");
    const leaseCheck = sql.indexOf("attempt_record.lease_expires_at <= commit_now");

    expect(assetLock).toBeGreaterThan(-1);
    expect(clockSample).toBeGreaterThan(assetLock);
    expect(deadlineCheck).toBeGreaterThan(clockSample);
    expect(leaseCheck).toBeGreaterThan(clockSample);
  });

  it("keeps the replacement RPC search-path hardened and service-role only", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql.match(/security definer/g)?.length).toBe(1);
    expect(sql.match(/set search_path = ''/g)?.length).toBe(1);
    expect(sql).toContain("revoke all on function public.commit_runtime_worker_preparation");
    expect(sql).toContain("grant execute on function public.commit_runtime_worker_preparation");
    expect(sql).toContain("to service_role");
    expect(sql).not.toMatch(/to\s+(anon|authenticated)/i);
  });
});
