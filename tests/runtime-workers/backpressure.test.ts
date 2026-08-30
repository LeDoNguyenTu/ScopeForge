import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  "supabase/migrations/20260831010500_phase_6d_runtime_worker_backpressure.sql",
);
const enqueueHardeningPath = path.resolve(
  "supabase/migrations/20260831010110_phase_6d_runtime_worker_control_hardening.sql",
);

function functionSql(sql: string, schema: "public" | "private", name: string): string {
  const matches = Array.from(sql.matchAll(new RegExp(
    `create or replace function ${schema}\\.${name}\\([\\s\\S]*?\\n\\$\\$;`,
    "gi",
  )));
  expect(matches.length).toBeGreaterThan(0);
  return matches.at(-1)?.[0] ?? "";
}

describe("Phase 6D worker backpressure", () => {
  it("keeps one live Phase 6D task per workspace across both network classes", async () => {
    const sql = await readFile(enqueueHardeningPath, "utf8");
    expect(sql).toMatch(/pg_advisory_xact_lock\(hashtextextended\('scopeforge-runtime-worker-workspace-v1:' \|\| target_workspace_id::text, 0\)\)/i);
    expect(sql).toMatch(/active_task\.execution_class in \(\s*'passive_runtime_observation_v1',\s*'active_cors_validation_v1'\s*\)/i);
    expect(sql).toMatch(/active_task\.state in \('queued', 'leased', 'retry_wait'\)/i);
  });

  it("preserves the global four-lease ceiling and adds passive two plus active one ceilings", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const claim = functionSql(sql, "public", "claim_runtime_worker_task");

    expect(claim).toMatch(/from private\.worker_tasks\s+where state = 'leased'[\s\S]*?>= 4/i);
    expect(claim).toMatch(/worker_record\.execution_class = 'passive_runtime_observation_v1'[\s\S]*?execution_class = 'passive_runtime_observation_v1'[\s\S]*?>= 2/i);
    expect(claim).toMatch(/worker_record\.execution_class = 'active_cors_validation_v1'[\s\S]*?execution_class = 'active_cors_validation_v1'[\s\S]*?>= 1/i);
    expect(claim).toMatch(/t\.execution_class = worker_record\.execution_class/i);
    expect(claim).toMatch(/and state = 'queued'\s*and attempt_count = 0\s*and max_attempts = 1/i);
  });

  it("terminalizes cancelled queued runtime work without creating an attempt", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const recoverCancelled = functionSql(sql, "private", "recover_cancelled_runtime_worker_tasks");

    expect(recoverCancelled).toMatch(/execution_class in \(\s*'passive_runtime_observation_v1',\s*'active_cors_validation_v1'\s*\)/i);
    expect(recoverCancelled).toMatch(/t\.state in \('queued', 'retry_wait'\)/i);
    expect(recoverCancelled).toMatch(/j\.cancel_requested_at is not null\s+or j\.status = 'cancelled'::public\.scan_job_status/i);
    expect(recoverCancelled).toMatch(/set state = 'cancelled'/i);
    expect(recoverCancelled).not.toMatch(/insert into private\.worker_attempts/i);
  });

  it("runs cancellation reconciliation from the existing recovery entrypoint", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const recover = functionSql(sql, "public", "recover_worker_state");

    expect(recover).toContain("private.recover_cancelled_runtime_worker_tasks(target_now)");
    expect(recover).toContain("public.recover_expired_worker_attempts_leased_only(target_now)");
    expect(recover).toContain("private.recover_expired_runtime_worker_tasks(target_now)");
    expect(sql).toMatch(/revoke all on function private\.recover_cancelled_runtime_worker_tasks\(timestamptz\) from public, anon, authenticated, service_role/i);
    expect(sql).toMatch(/grant execute on function public\.recover_worker_state\(timestamptz\) to service_role/i);
  });

  it("keeps every new definer function on an empty search path", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const definerCount = (sql.match(/security definer/g) ?? []).length;
    const definerSearchPaths = (sql.match(/security definer\s+set search_path = ''/g) ?? []).length;
    expect(definerSearchPaths).toBe(definerCount);
  });
});
