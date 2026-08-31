import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  "supabase/migrations/20260831010120_phase_6d_runtime_worker_recovery.sql",
);
const leasedRecoveryMigrationPath = path.resolve(
  "supabase/migrations/20260826110130_phase_6a_worker_recovery.sql",
);

describe("Phase 6D runtime worker recovery migration", () => {
  it("dead-letters expired unleased Phase 6D tasks without creating retry authority", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/create or replace function private\.recover_expired_runtime_worker_tasks\(/i);
    expect(sql).toMatch(/execution_class in \(\s*'passive_runtime_observation_v1',\s*'active_cors_validation_v1'\s*\)/i);
    expect(sql).toMatch(/state in \('queued', 'retry_wait'\)/i);
    expect(sql).toMatch(/absolute_deadline_at <= target_now/i);
    expect(sql).toMatch(/set state = 'dead_letter'/i);
    expect(sql).not.toMatch(/set state = 'retry_wait'/i);
    expect(sql).not.toMatch(/attempt_count\s*=\s*attempt_count\s*\+/i);
  });

  it("proves max-attempts one cannot enter generic lease retry scheduling", async () => {
    const sql = await readFile(leasedRecoveryMigrationPath, "utf8");
    expect(sql).toMatch(/elsif task_record\.attempt_count < task_record\.max_attempts then/i);
    expect(sql).toMatch(/set state = 'retry_wait'/i);
    expect(sql).toMatch(/else\s+update private\.worker_tasks\s+set state = 'dead_letter'/i);
    expect(sql).toContain("WORKER_ATTEMPTS_EXHAUSTED");
  });

  it("blocks a domain job that expired before preparation instead of leaving it queued", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/status = 'blocked'::public\.scan_job_status/i);
    expect(sql).toContain("RUNTIME_WORKER_EXECUTION_FAILED");
    expect(sql).toContain("Runtime worker attempt expired before preparation completed.");
    expect(sql).toMatch(/status = 'queued'::public\.scan_job_status/i);
  });

  it("reconciles a leased Phase 6D task that the generic lease recovery dead-lettered before preparation", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/create or replace function private\.reconcile_dead_letter_runtime_worker_jobs\(/i);
    expect(sql).toMatch(/t\.state = 'dead_letter'/i);
    expect(sql).toMatch(/j\.status = 'queued'::public\.scan_job_status/i);
    expect(sql).toMatch(/set status = 'blocked'::public\.scan_job_status/i);
  });

  it("extends the existing recovery wrapper without granting direct helper execution", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/create or replace function public\.recover_worker_state\(/i);
    expect(sql).toContain("public.recover_expired_worker_attempts_leased_only(target_now)");
    expect(sql).toContain("private.recover_expired_unleased_worker_tasks(target_now)");
    expect(sql).toContain("private.recover_expired_runtime_worker_tasks(target_now)");
    expect(sql).toContain("private.reconcile_dead_letter_runtime_worker_jobs(target_now)");
    expect(sql).toMatch(/revoke all on function private\.recover_expired_runtime_worker_tasks\(timestamptz\)\s+from public, anon, authenticated, service_role/i);
    expect(sql).toMatch(/revoke all on function private\.reconcile_dead_letter_runtime_worker_jobs\(timestamptz\)\s+from public, anon, authenticated, service_role/i);
    expect(sql).toMatch(/revoke all on function public\.recover_worker_state\(timestamptz\)\s+from public, anon, authenticated, service_role/i);
    expect(sql).toMatch(/grant execute on function public\.recover_worker_state\(timestamptz\)\s+to service_role/i);
    const functionCount = (sql.match(/create or replace function (?:private|public)\./g) ?? []).length;
    const searchPathCount = (sql.match(/set search_path = ''/g) ?? []).length;
    expect(searchPathCount).toBe(functionCount);
  });
});
