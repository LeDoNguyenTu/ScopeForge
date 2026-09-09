import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260831010900_phase_6d_runtime_worker_finalization_recovery_lock.sql",
);

function functionBody(sql: string, functionName: string): string {
  const start = sql.indexOf(`create or replace function public.${functionName}`);
  expect(start).toBeGreaterThan(-1);
  const next = sql.indexOf("create or replace function public.", start + 1);
  return sql.slice(start, next === -1 ? sql.length : next);
}

describe("Phase 6D finalization/recovery lock hardening migration", () => {
  it("serializes finalization context against leased recovery before row locks", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const body = functionBody(sql, "get_runtime_worker_finalization_context");
    const advisoryLock = body.indexOf(
      "pg_advisory_xact_lock(hashtextextended('scopeforge-worker-recovery-v1', 0))",
    );
    const taskLock = body.indexOf("from private.worker_tasks");
    const attemptLock = body.indexOf("from private.worker_attempts");

    expect(advisoryLock).toBeGreaterThan(-1);
    expect(advisoryLock).toBeLessThan(taskLock);
    expect(taskLock).toBeLessThan(attemptLock);
  });

  it("serializes terminal commit against leased recovery before row locks", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const body = functionBody(sql, "finalize_runtime_worker_attempt");
    const advisoryLock = body.indexOf(
      "pg_advisory_xact_lock(hashtextextended('scopeforge-worker-recovery-v1', 0))",
    );
    const taskLock = body.indexOf("from private.worker_tasks");
    const attemptLock = body.indexOf("from private.worker_attempts");

    expect(advisoryLock).toBeGreaterThan(-1);
    expect(advisoryLock).toBeLessThan(taskLock);
    expect(taskLock).toBeLessThan(attemptLock);
  });

  it("samples the terminal timestamp after the domain job row is locked", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const body = functionBody(sql, "finalize_runtime_worker_attempt");
    const jobLock = body.indexOf("from public.scan_jobs");
    const clockSample = body.indexOf("finish_now := clock_timestamp();");

    expect(jobLock).toBeGreaterThan(-1);
    expect(clockSample).toBeGreaterThan(jobLock);
  });

  it("preserves exact-digest replay and cancellation-wins behavior", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const body = functionBody(sql, "finalize_runtime_worker_attempt");

    expect(body).toContain("attempt_record.terminal_payload_digest = target_terminal_digest");
    expect(body).toContain("'outcome', attempt_record.outcome");
    expect(body).toContain("when job_record.cancel_requested_at is not null then 'cancelled'");
    expect(body).not.toContain("attempt_record.lease_expires_at <= finish_now");
  });

  it("keeps both replacement RPCs search-path hardened and service-role only", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql.match(/security definer/g)?.length).toBe(2);
    expect(sql.match(/set search_path = ''/g)?.length).toBe(2);
    expect(sql).toContain("revoke all on function public.get_runtime_worker_finalization_context");
    expect(sql).toContain("grant execute on function public.get_runtime_worker_finalization_context");
    expect(sql).toContain("revoke all on function public.finalize_runtime_worker_attempt");
    expect(sql).toContain("grant execute on function public.finalize_runtime_worker_attempt");
    expect(sql).toContain("to service_role");
    expect(sql).not.toMatch(/to\s+(anon|authenticated)/i);
  });
});
