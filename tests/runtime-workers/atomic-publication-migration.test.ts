import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260831011200_phase_6d_atomic_runtime_publication.sql",
);

function functionBody(sql: string, functionName: string): string {
  const start = sql.indexOf(`create or replace function public.${functionName}`);
  expect(start).toBeGreaterThan(-1);
  const next = sql.indexOf("create or replace function public.", start + 1);
  return sql.slice(start, next === -1 ? sql.length : next);
}

describe("Phase 6D atomic success publication migration", () => {
  for (const [name, persistence] of [
    ["publish_passive_runtime_worker_success", "persist_passive_runtime_result"],
    ["publish_active_cors_worker_success", "persist_active_validation_result"],
  ] as const) {
    it(`${name} serializes persistence and success finalization against recovery`, async () => {
      const sql = await readFile(migrationPath, "utf8");
      const body = functionBody(sql, name);
      const recoveryLock = body.indexOf(
        "pg_advisory_xact_lock(hashtextextended('scopeforge-worker-recovery-v1', 0))",
      );
      const context = body.indexOf("get_runtime_worker_finalization_context");
      const persist = body.indexOf(persistence);
      const successFinalize = body.lastIndexOf("finalize_runtime_worker_attempt");

      expect(recoveryLock).toBeGreaterThan(-1);
      expect(context).toBeGreaterThan(recoveryLock);
      expect(persist).toBeGreaterThan(context);
      expect(successFinalize).toBeGreaterThan(persist);
    });
  }

  it("handles replay and cancellation before any success persistence", async () => {
    const sql = await readFile(migrationPath, "utf8");
    for (const name of [
      "publish_passive_runtime_worker_success",
      "publish_active_cors_worker_success",
    ]) {
      const body = functionBody(sql, name);
      const persistence = body.indexOf(name.includes("passive")
        ? "persist_passive_runtime_result"
        : "persist_active_validation_result");
      expect(body.indexOf("context_record->>'finishedAt' is not null")).toBeLessThan(persistence);
      expect(body.indexOf("(context_record->>'cancelRequested')::boolean")).toBeLessThan(persistence);
      expect(body.indexOf("finalize_runtime_worker_attempt")).toBeLessThan(persistence);
    }
  });

  it("derives finding count from canonical finding rows", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql.match(/jsonb_array_length\(finding_rows\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps both atomic publication RPCs search-path hardened and service-role only", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql.match(/security definer/g)?.length).toBe(2);
    expect(sql.match(/set search_path = ''/g)?.length).toBe(2);
    expect(sql).toContain("revoke all on function public.publish_passive_runtime_worker_success");
    expect(sql).toContain("revoke all on function public.publish_active_cors_worker_success");
    expect(sql).toContain("to service_role");
    expect(sql).not.toMatch(/to\s+(anon|authenticated)/i);
  });
});
