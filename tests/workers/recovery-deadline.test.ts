import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260826110400_phase_6a_worker_deadline_recovery.sql",
);

describe("Phase 6A unleased deadline recovery", () => {
  it("dead-letters queued or retry-wait tasks after their absolute deadline", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("state in ('queued', 'retry_wait')");
    expect(sql).toContain("absolute_deadline_at <= target_now");
    expect(sql).toContain("state = 'dead_letter'");
    expect(sql).toContain("WORKER_BUDGET_EXCEEDED");
  });

  it("makes one service-role recovery entry point authoritative", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("create or replace function public.recover_worker_state");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("public.recover_expired_worker_attempts(target_now)");
    expect(sql).toMatch(/revoke all on function public\.recover_expired_worker_attempts\(timestamptz\) from service_role;/i);
    expect(sql).toMatch(/grant execute on function public\.recover_worker_state\(timestamptz\) to service_role;/i);
  });
});
