import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const deadlineMigrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260826110400_phase_6a_worker_deadline_recovery.sql",
);
const compatibilityMigrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260826110600_phase_6a_worker_recovery_compat.sql",
);

describe("Phase 6A unleased deadline recovery", () => {
  it("dead-letters queued or retry-wait tasks after their absolute deadline", async () => {
    const sql = await readFile(deadlineMigrationPath, "utf8");
    expect(sql).toContain("state in ('queued', 'retry_wait')");
    expect(sql).toContain("absolute_deadline_at <= target_now");
    expect(sql).toContain("state = 'dead_letter'");
    expect(sql).toContain("WORKER_BUDGET_EXCEEDED");
  });

  it("keeps one stable combined service-role recovery entry point", async () => {
    const sql = await readFile(compatibilityMigrationPath, "utf8");
    expect(sql).toContain("rename to recover_expired_worker_attempts_leased_only");
    expect(sql).toContain("private.recover_expired_unleased_worker_tasks(target_now)");
    expect(sql).toContain("public.recover_expired_worker_attempts_leased_only(target_now)");
    expect(sql).toContain("create or replace function public.recover_expired_worker_attempts");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toMatch(/revoke all on function public\.recover_expired_worker_attempts_leased_only\(timestamptz\) from public, anon, authenticated, service_role;/i);
    expect(sql).toMatch(/revoke all on function public\.recover_worker_state\(timestamptz\) from public, anon, authenticated, service_role;/i);
    expect(sql).toMatch(/grant execute on function public\.recover_expired_worker_attempts\(timestamptz\) to service_role;/i);
  });
});
