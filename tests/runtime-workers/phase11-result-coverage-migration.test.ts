import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260919020000_phase_11c_result_coverage_reconciliation.sql";

describe("Phase 11C result-to-coverage reconciliation migration", () => {
  it("persists bounded request usage on private action attempts", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/alter table private\.pentest_action_attempts[\s\S]*?add column request_count integer not null default 0/i);
    expect(sql).toMatch(/pentest_action_attempts_request_count_check[\s\S]*?request_count >= 0/i);
  });

  it("keeps coverage reconciliation private and atomically mirrors privacy-reduced counters", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const start = sql.indexOf("create or replace function private.apply_phase11_attempt_coverage");
    const end = sql.indexOf("create or replace function public.finalize_phase11_http_worker_attempt");
    const fn = sql.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(fn).toContain("private.pentest_coverage");
    expect(fn).toContain("public.pentest_coverage_summaries");
    expect(fn).toContain("request_count");
    expect(fn).toContain("provider_failure_count");
    expect(fn).toContain("attempted_capability_ids");
    expect(fn).toContain("covered_node_ids");
    expect(fn).toContain("untested_node_ids");
    expect(fn).toMatch(/status in \('succeeded', 'no_signal', 'timed_out', 'provider_failed'\)/i);
    expect(fn).toMatch(/target_status = 'provider_failed'/i);
    expect(sql).toMatch(/revoke all on function private\.apply_phase11_attempt_coverage[\s\S]*?from public, anon, authenticated, service_role/i);
  });


  it("caps finalization accounting to the HTTP execution-class request ceiling", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const start = sql.indexOf(
      "create or replace function public.get_phase11_http_worker_finalization_context",
    );
    const end = sql.indexOf(
      "create or replace function public.finalize_phase11_http_worker_attempt",
      start,
    );
    const context = sql.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(context).toContain(
      "'maxRequests', least(action_record.max_requests, 12)",
    );
  });

  it("charges exact or conservative request usage during authenticated finalization", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const start = sql.indexOf("create or replace function public.finalize_phase11_http_worker_attempt");
    const end = sql.indexOf("create or replace function private.recover_phase11_http_unleased_worker_tasks");
    const fn = sql.slice(start, end);

    expect(fn).toMatch(/insert into private\.pentest_action_attempts[\s\S]*?request_count/i);
    expect(fn).toContain("target_request_count");
    expect(fn).toMatch(/perform private\.apply_phase11_attempt_coverage[\s\S]*?target_request_count/i);
    expect(fn).toMatch(/attempt_record\.finished_at is not null[\s\S]*?return jsonb_build_object\('outcome'/i);
  });

  it("charges expired leased attempts conservatively but never charges unclaimed work", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const unleasedStart = sql.indexOf("create or replace function private.recover_phase11_http_unleased_worker_tasks");
    const expiredStart = sql.indexOf("create or replace function private.recover_phase11_http_expired_worker_attempts");
    const end = sql.indexOf("create or replace function private.recover_worker_state");
    const unleased = sql.slice(unleasedStart, expiredStart);
    const expired = sql.slice(expiredStart, end);

    expect(unleased).toMatch(/request_count[\s\S]*?0,/i);
    expect(unleased).not.toContain("apply_phase11_attempt_coverage");
    expect(expired).toMatch(
      /request_count[\s\S]*?least\(action_record\.max_requests, 12\)/i,
    );
    expect(expired).toMatch(
      /perform private\.apply_phase11_attempt_coverage[\s\S]*?least\(action_record\.max_requests, 12\)/i,
    );
  });


  it("prevents stale graph persistence from rolling coverage counters backward", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const start = sql.indexOf("create or replace function public.persist_phase11_graph_state");
    const fn = sql.slice(start);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(fn).toContain("insert into private.pentest_coverage as current");
    expect(fn).toContain("greatest(current.request_count, excluded.request_count)");
    expect(fn).toContain(
      "greatest(\n        current.provider_failure_count,\n        excluded.provider_failure_count",
    );
    expect(fn).toContain(
      "greatest(\n        current.graph_expansion_count,\n        excluded.graph_expansion_count",
    );
    expect(fn).toContain("current.attempted_capability_ids || excluded.attempted_capability_ids");
    expect(fn).toContain("current.covered_node_ids || excluded.covered_node_ids");
    expect(fn).toContain("into persisted_coverage");
    expect(fn).toContain("persisted_coverage.request_count");
    expect(fn).toContain("persisted_coverage.provider_failure_count");
  });

  it("does not grant browser roles mutation authority", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).not.toMatch(/grant\s+(?:insert|update|delete|all)[\s\S]*?to\s+(?:anon|authenticated)/i);
    expect(sql).toMatch(/grant execute on function public\.finalize_phase11_http_worker_attempt[\s\S]*?to service_role/i);
  });
});
