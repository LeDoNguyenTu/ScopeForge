import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260831010300_phase_6d_runtime_worker_publication.sql",
);

describe("Phase 6D publication migration", () => {
  it("keeps finalization RPCs service-role only and search-path hardened", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql.match(/security definer/g)?.length).toBe(2);
    expect(sql.match(/set search_path = ''/g)?.length).toBe(2);
    expect(sql).toContain("grant execute on function public.get_runtime_worker_finalization_context");
    expect(sql).toContain("grant execute on function public.finalize_runtime_worker_attempt");
    expect(sql).toContain("to service_role");
    expect(sql).not.toMatch(/grant\s+(select|insert|update|delete)\s+on\s+(table\s+)?private[.]/i);
  });

  it("binds worker, task, attempt, lease hash, class, and immutable runtime task before finalization", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("attempt_record.worker_id <> target_worker_id");
    expect(sql).toContain("attempt_record.lease_token_hash <> supplied_hash");
    expect(sql).toContain("task_record.execution_class <> target_execution_class");
    expect(sql).toContain("private.runtime_worker_tasks");
    expect(sql).toContain("WORKER_TERMINAL_CONFLICT");
  });

  it("makes cancellation authoritative over a raced success and preserves single-attempt terminality", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("when job_record.cancel_requested_at is not null then 'cancelled'");
    expect(sql).toContain("and finished_at is null");
    expect(sql).toContain("terminal_payload_digest = target_terminal_digest");
    expect(sql).toContain("replayed', true");
  });

  it("replays an identical terminal digest using the stored effective outcome after cancellation override", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/if attempt_record\.terminal_payload_digest = target_terminal_digest then\s+return jsonb_build_object\(\s*'outcome', attempt_record\.outcome,\s*'replayed', true\s*\);/i);
    expect(sql).not.toContain("and attempt_record.outcome = target_outcome");
  });
});
