import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const schemaMigration = path.resolve(
  "supabase/migrations/20260831010000_phase_6d_runtime_worker_schema.sql",
);
const controlMigration = path.resolve(
  "supabase/migrations/20260831010100_phase_6d_runtime_worker_control.sql",
);
const fkIndexMigration = path.resolve(
  "supabase/migrations/20260831010200_phase_6d_runtime_worker_fk_indexes.sql",
);

describe("Phase 6D runtime worker schema migrations", () => {
  it("widens only the fixed worker execution-class constraints", async () => {
    const sql = await readFile(schemaMigration, "utf8");
    const expectedClasses = [
      "foundation_no_egress_v1",
      "repository_snapshot_github_public_v1",
      "phase3_repository_scan_no_egress_v1",
      "passive_runtime_observation_v1",
      "active_cors_validation_v1",
    ];
    for (const executionClass of expectedClasses) expect(sql).toContain(`'${executionClass}'`);
    expect(sql).toMatch(/worker_nodes_execution_class_check/i);
    expect(sql).toMatch(/worker_tasks_execution_class_check/i);
    expect(sql).not.toMatch(/alter type public\.scan_job_kind\s+add value/i);
    expect(sql).not.toMatch(/network_policy\s+(text|jsonb)/i);
    expect(sql).not.toMatch(/\b(url|hostname|headers|body|method|command|image|environment)\s+(text|jsonb)/i);
  });

  it("binds one private runtime worker task to one existing Phase 4 domain job", async () => {
    const sql = await readFile(schemaMigration, "utf8");
    expect(sql).toContain("create table private.runtime_worker_tasks");
    expect(sql).toContain("task_id uuid primary key references private.worker_tasks(id) on delete cascade");
    expect(sql).toContain("scan_job_id uuid not null unique");
    expect(sql).toContain("workspace_id uuid not null");
    expect(sql).toContain("asset_id uuid not null");
    expect(sql).toContain("requested_by uuid not null references auth.users(id) on delete restrict");
    expect(sql).toContain("domain_job_kind public.scan_job_kind not null");
    expect(sql).toContain("schema_version smallint not null default 1 check (schema_version = 1)");
    expect(sql).toMatch(/domain_job_kind in \(\s*'passive_runtime'::public\.scan_job_kind,\s*'active_validation'::public\.scan_job_kind\s*\)/i);
    expect(sql).toContain("foreign key (scan_job_id, workspace_id, asset_id)");
    expect(sql).toContain("references public.scan_jobs(id, workspace_id, asset_id)");
    expect(sql).toContain("foreign key (asset_id, workspace_id)");
    expect(sql).toContain("references public.assets(id, workspace_id)");
    expect(sql).toMatch(/revoke all on table private\.runtime_worker_tasks from public, anon, authenticated, service_role/i);
  });

  it("uses one-attempt short deadlines and workspace-wide live-task backpressure", async () => {
    const sql = await readFile(controlMigration, "utf8");
    expect(sql).toMatch(/max_attempts\s*,\s*absolute_deadline_at/i);
    expect(sql).toMatch(/'passive_runtime_observation_v1'[\s\S]*?1\s*,\s*request_now \+ interval '30 seconds'/i);
    expect(sql).toMatch(/'active_cors_validation_v1'[\s\S]*?1\s*,\s*request_now \+ interval '20 seconds'/i);
    expect(sql).toMatch(/state in \('queued', 'leased', 'retry_wait'\)/i);
    expect(sql).toMatch(/execution_class in \(\s*'passive_runtime_observation_v1',\s*'active_cors_validation_v1'\s*\)/i);
    expect(sql).toContain("RUNTIME_WORKER_ACTIVE_LIMIT");
  });

  it("adds covering indexes for each Phase 6D foreign-key path", async () => {
    const [schemaSql, indexSql] = await Promise.all([
      readFile(schemaMigration, "utf8"),
      readFile(fkIndexMigration, "utf8"),
    ]);
    const sql = `${schemaSql}\n${indexSql}`;
    for (const index of [
      "runtime_worker_tasks_job_workspace_asset_idx",
      "runtime_worker_tasks_asset_workspace_idx",
      "runtime_worker_tasks_requested_by_idx",
      "runtime_worker_tasks_workspace_created_idx",
    ]) expect(sql).toContain(index);
  });
});
