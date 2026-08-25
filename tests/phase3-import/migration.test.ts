import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const enumMigrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260826100000_phase_5c_phase3_import_enum.sql",
);
const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260826100100_phase_5c_phase3_import.sql",
);
const databaseTypesPath = path.resolve(process.cwd(), "lib/database.types.ts");

describe("Phase 5C hosted Phase 3 import migration", () => {
  it("commits the import job enum before the schema migration uses it", async () => {
    const [enumSql, sql] = await Promise.all([
      readFile(enumMigrationPath, "utf8"),
      readFile(migrationPath, "utf8"),
    ]);

    expect(enumSql).toContain("alter type public.scan_job_kind");
    expect(enumSql).toContain("add value if not exists 'phase3_import'");
    expect(sql).not.toContain("add value if not exists 'phase3_import'");
  });

  it("keeps the manual database contract aligned with the Phase 5C enum, table and RPC", async () => {
    const types = await readFile(databaseTypesPath, "utf8");

    expect(types).toContain('export type ScanJobKind = "phase2_blocked" | "passive_runtime" | "active_validation" | "phase3_import";');
    expect(types).toContain("export type SecurityPhase3ImportRunRow = {");
    expect(types).toContain("security_phase3_import_runs: {");
    expect(types).toContain("persist_phase3_import_result: {");
  });

  it("adds one immutable repository-bound import-run table with bounded provenance", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("create table public.security_phase3_import_runs");
    expect(sql).toContain("run_ref text not null");
    expect(sql).toContain("repository_canonical_url text not null");
    expect(sql).toContain("scanner_descriptors jsonb not null");
    expect(sql).toContain("unique (workspace_id, asset_id, run_ref)");
    expect(sql).toContain("reject_security_phase3_import_run_mutation");
    expect(sql).toContain("before update on public.security_phase3_import_runs");
    expect(sql).toContain("before delete on public.security_phase3_import_runs");
  });

  it("keeps browser access RLS-protected and SELECT-only", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("alter table public.security_phase3_import_runs enable row level security");
    expect(sql).toContain("private.is_workspace_member(workspace_id)");
    expect(sql).toContain("revoke all on table public.security_phase3_import_runs from public, anon, authenticated");
    expect(sql).toContain("grant select on table public.security_phase3_import_runs to authenticated");
    expect(sql).not.toMatch(/grant\s+(insert|update|delete)\s+on\s+table\s+public\.security_phase3_import_runs\s+to\s+authenticated/i);
  });

  it("exposes one atomic service-role-only SECURITY DEFINER persistence RPC", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("create or replace function public.persist_phase3_import_result");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toMatch(/revoke all on function public\.persist_phase3_import_result[\s\S]*from public, anon, authenticated;/i);
    expect(sql).toMatch(/grant execute on function public\.persist_phase3_import_result[\s\S]*to service_role;/i);
  });

  it("re-checks actor membership and exact repository asset binding inside the database", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("from public.workspace_members");
    expect(sql).toContain("role::text in ('owner', 'admin', 'member')");
    expect(sql).toContain("from public.assets");
    expect(sql).toContain("asset_kind_text <> 'repository'");
    expect(sql).toContain("asset_canonical_target is distinct from target_repository_canonical_url");
    expect(sql).toContain("PHASE3_IMPORT_ASSET_MISMATCH");
  });

  it("creates only terminal repository import jobs with no runtime authority", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("job_kind = 'phase3_import'::public.scan_job_kind");
    expect(sql).toContain("authorization_asset_kind = 'repository'::public.asset_kind");
    expect(sql).toContain("budget = '{}'::jsonb");
    expect(sql).toContain("'succeeded'::public.scan_job_status");
    expect(sql).toContain("request_count = 0");
    expect(sql).toContain("redirect_count = 0");
    expect(sql).not.toContain("http-observation");
    expect(sql).not.toContain("tls-observation");
    expect(sql).not.toContain("cors-policy");
  });

  it("bounds import payloads and allows only reviewed static evidence/provenance", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("jsonb_array_length(finding_rows) > 500");
    expect(sql).toContain("jsonb_array_length(evidence_rows) > 500");
    expect(sql).toContain("'deterministic-passive-scanner'");
    expect(sql).toContain("'scanner-derived'");
    expect(sql).toContain("('static-analysis', 'dependency')");
    expect(sql).toContain("'internal'");
    expect(sql).toContain("artifact_ref");
    expect(sql).toContain("PHASE3_IMPORT_PAYLOAD_INVALID");
  });

  it("makes exact retries idempotent and conflicting reuse fail closed", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("PHASE3_IMPORT_RUN_REF_CONFLICT");
    expect(sql).toContain("replayed");
    expect(sql).toMatch(/where workspace_id = target_workspace_id[\s\S]*asset_id = target_asset_id[\s\S]*run_ref = target_run_ref[\s\S]*for update;/i);
  });

  it("reuses canonical finding recurrence without treating absence as a fix", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("when 'verified_fixed' then 'open'");
    expect(sql).toContain("when 'resolved' then 'in_progress'");
    expect(sql).toContain("when 'retest_pending' then 'in_progress'");
    expect(sql).toContain("when 'accepted_risk' then existing_finding.lifecycle_state");
    expect(sql).toContain("when 'false_positive' then existing_finding.lifecycle_state");
    expect(sql).toContain("finding.reobserved");
    expect(sql).toContain("finding.reopened");
    expect(sql).not.toMatch(/set\s+lifecycle_state\s*=\s*'verified_fixed'/i);
    expect(sql).not.toMatch(/update\s+public\.security_findings[\s\S]*where\s+not\s+exists[\s\S]*verified_fixed/i);
  });
});