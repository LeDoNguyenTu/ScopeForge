import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260831010400_phase_6d_runtime_worker_request.sql",
);

describe("Phase 6D hosted request transaction", () => {
  it("creates the authorized domain job and closed worker task in one database transaction", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("request_passive_runtime_worker_job");
    expect(sql).toContain("request_active_cors_worker_job");
    expect(sql).toContain("enqueue_passive_runtime_worker_task");
    expect(sql).toContain("enqueue_active_cors_worker_task");
    expect(sql).toContain("insert into public.scan_jobs");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toMatch(/revoke all on function public\.request_passive_runtime_worker_job/i);
    expect(sql).toMatch(/revoke all on function public\.request_active_cors_worker_job/i);
    expect(sql).toMatch(/grant execute on function public\.request_passive_runtime_worker_job[^;]+to service_role/is);
    expect(sql).toMatch(/grant execute on function public\.request_active_cors_worker_job[^;]+to service_role/is);
    expect(sql).not.toMatch(/grant execute[^;]+to authenticated/is);
    expect(sql).not.toMatch(/grant execute[^;]+to anon/is);
  });

  it("does not accept caller-selected transport or worker execution authority", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const signatures = sql
      .split("create or replace function public.")
      .filter((part) => part.startsWith("request_passive_runtime_worker_job") || part.startsWith("request_active_cors_worker_job"))
      .join("\n");

    expect(signatures).not.toMatch(/target_url|target_hostname|target_method|target_headers|target_body|target_worker|target_execution_class|target_network/i);
    expect(signatures).not.toMatch(/http|https|fetch|proxy/i);
  });
});
