import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260826110000_phase_6a_worker_foundation.sql",
);

describe("Phase 6A worker foundation migration", () => {
  it("creates private worker node, task, and attempt state only", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("create table private.worker_nodes");
    expect(sql).toContain("create table private.worker_tasks");
    expect(sql).toContain("create table private.worker_attempts");
    expect(sql).toContain("foundation_no_egress_v1");
    expect(sql).toContain("foreign key (scan_job_id, workspace_id, asset_id)");
    expect(sql).toContain("references public.scan_jobs(id, workspace_id, asset_id)");
    expect(sql).toContain("unique (task_id, attempt_number)");
  });

  it("does not store caller-selected execution authority", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).not.toMatch(/\bcommand\s+text\b/i);
    expect(sql).not.toMatch(/\bshell\s+text\b/i);
    expect(sql).not.toMatch(/\bimage\s+text\b/i);
    expect(sql).not.toMatch(/\benvironment\s+jsonb\b/i);
    expect(sql).not.toMatch(/\bheaders\s+jsonb\b/i);
    expect(sql).not.toMatch(/\bbody\s+jsonb\b/i);
    expect(sql).not.toMatch(/\bnetwork_policy\b/i);
    expect(sql).not.toMatch(/\bpackage_manager\b/i);
  });

  it("guards immutable identity and terminal scheduling state", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("guard_worker_task_update");
    expect(sql).toContain("guard_worker_attempt_update");
    expect(sql).toContain("Worker task identity fields are immutable");
    expect(sql).toContain("Worker task terminal states are immutable");
    expect(sql).toContain("Worker attempt identity fields are immutable");
    expect(sql).toContain("worker_tasks_claim_idx");
    expect(sql).toContain("worker_attempts_active_lease_idx");
  });

  it("keeps private worker tables outside browser grants", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toMatch(/revoke all on table private\.worker_nodes from public, anon, authenticated;/i);
    expect(sql).toMatch(/revoke all on table private\.worker_tasks from public, anon, authenticated;/i);
    expect(sql).toMatch(/revoke all on table private\.worker_attempts from public, anon, authenticated;/i);
    expect(sql).not.toMatch(/grant\s+(select|insert|update|delete)[\s\S]*private\.worker_(nodes|tasks|attempts)[\s\S]*to\s+(anon|authenticated)/i);
  });
});
