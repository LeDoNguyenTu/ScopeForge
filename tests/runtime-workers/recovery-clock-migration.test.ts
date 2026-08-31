import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260831011100_worker_recovery_clock.sql",
);

function functionBody(sql: string, functionName: string): string {
  const start = sql.indexOf(`create or replace function public.${functionName}`);
  expect(start).toBeGreaterThan(-1);
  const next = sql.indexOf("create or replace function public.", start + 1);
  return sql.slice(start, next === -1 ? sql.length : next);
}

describe("worker recovery clock hardening", () => {
  it("samples live recovery time only after acquiring the recovery lock", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const body = functionBody(sql, "recover_worker_state");
    const advisory = body.indexOf(
      "pg_advisory_xact_lock(hashtextextended('scopeforge-worker-recovery-v1', 0))",
    );
    const clockSample = body.indexOf("effective_now := coalesce(target_now, clock_timestamp());");

    expect(advisory).toBeGreaterThan(-1);
    expect(clockSample).toBeGreaterThan(advisory);
    expect(body).toContain("private.recover_cancelled_runtime_worker_tasks(effective_now)");
    expect(body).toContain("public.recover_expired_worker_attempts_leased_only(effective_now)");
    expect(body).toContain("private.recover_expired_unleased_worker_tasks(effective_now)");
    expect(body).toContain("private.recover_expired_runtime_worker_tasks(effective_now)");
    expect(body).toContain("private.reconcile_dead_letter_runtime_worker_jobs(effective_now)");
  });

  it("keeps deterministic explicit timestamps on the canonical recovery function", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const body = functionBody(sql, "recover_worker_state");
    expect(body).toContain("target_now timestamptz default null");
    expect(body).toContain("coalesce(target_now, clock_timestamp())");
  });

  it("makes the legacy production wrapper request a post-lock wall clock", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const body = functionBody(sql, "recover_expired_worker_attempts");
    expect(body).toContain("select public.recover_worker_state(null);");
    expect(body).not.toContain("recover_worker_state(target_now)");
  });

  it("keeps both public recovery RPCs hardened and service-role only", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql.match(/security definer/g)?.length).toBe(2);
    expect(sql.match(/set search_path = ''/g)?.length).toBe(2);
    expect(sql).toContain("revoke all on function public.recover_worker_state(timestamptz)");
    expect(sql).toContain("revoke all on function public.recover_expired_worker_attempts(timestamptz)");
    expect(sql).toContain("grant execute on function public.recover_worker_state(timestamptz)");
    expect(sql).toContain("grant execute on function public.recover_expired_worker_attempts(timestamptz)");
    expect(sql).not.toMatch(/to\s+(anon|authenticated)/i);
  });
});
