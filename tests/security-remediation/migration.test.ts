import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260825090000_phase_5b_remediation_retest_security_story.sql",
);

async function migrationSql(): Promise<string> {
  return readFile(migrationPath, "utf8");
}

describe("Phase 5B remediation and retest migration", () => {
  it("creates one workspace-scoped remediation row and bounded retest history", async () => {
    const sql = await migrationSql();

    expect(sql).toContain("create table public.security_finding_work");
    expect(sql).toContain("create table public.security_finding_retests");
    expect(sql).toContain("primary key (workspace_id, finding_id)");
    expect(sql).toContain("char_length(remediation_note) <= 2000");
    expect(sql).toContain("security_finding_retests_one_active_per_finding");
    expect(sql).toContain("where status in ('requested', 'running')");
  });

  it("binds workflow rows to canonical findings, assets, jobs, and users", async () => {
    const sql = await migrationSql();

    expect(sql).toContain("references public.security_findings(workspace_id, finding_id)");
    expect(sql).toContain("references public.assets(id, workspace_id)");
    expect(sql).toContain("references public.scan_jobs(id, workspace_id, asset_id)");
    expect(sql).toContain("assignee_user_id uuid references auth.users(id)");
    expect(sql).toContain("updated_by uuid not null references auth.users(id)");
    expect(sql).toContain("requested_by uuid not null references auth.users(id)");
  });

  it("constrains active and passive immutable retest snapshots", async () => {
    const sql = await migrationSql();

    expect(sql).toContain("execution_kind in ('passive_runtime', 'active_validation')");
    expect(sql).toContain("status in ('requested', 'running', 'still_present', 'verified_fixed', 'inconclusive', 'failed', 'cancelled')");
    expect(sql).toContain("validation_profile_id = 'cors-origin-policy'");
    expect(sql).toContain("validation_profile_version = 1");
    expect(sql).toContain("active_consent_granted_at is not null");
    expect(sql).toContain("validation_profile_id is null");
    expect(sql).toContain("active_consent_granted_at is null");
    expect(sql).toContain("Retest execution snapshot fields are immutable");
  });

  it("requires coherent retest timestamps and bounded result codes", async () => {
    const sql = await migrationSql();

    expect(sql).toContain("char_length(result_code) <= 100");
    expect(sql).toContain("status = 'running'");
    expect(sql).toContain("started_at is not null");
    expect(sql).toContain("scan_job_id is not null");
    expect(sql).toContain("completed_at is not null");
  });

  it("keeps authenticated browser access select-only", async () => {
    const sql = await migrationSql();

    for (const table of ["security_finding_work", "security_finding_retests"] as const) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`grant select on table public.${table} to authenticated`);
    }

    expect(sql).not.toMatch(
      /grant\s+(?:insert|update|delete)\s+on\s+table\s+public\.security_finding_(?:work|retests)\s+to\s+authenticated/i,
    );
  });

  it("extends append-only finding history for remediation and retesting", async () => {
    const sql = await migrationSql();

    for (const event of [
      "finding.assignment_changed",
      "finding.remediation_note_updated",
      "finding.retest_requested",
      "finding.retest_started",
      "finding.retest_completed",
    ]) {
      expect(sql).toContain(`'${event}'`);
    }
  });

  it("adds covering indexes for Phase 5A foreign keys reported by production advisors", async () => {
    const sql = await migrationSql();

    expect(sql).toContain("on public.security_findings(asset_id, workspace_id)");
    expect(sql).toContain("on public.security_evidence(asset_id, workspace_id)");
    expect(sql).toContain("on public.security_finding_occurrences(asset_id, workspace_id)");
    expect(sql).toContain("on public.security_finding_events(actor_id)");
  });

  it("implements remediation work changes as a service-role-only trusted transaction", async () => {
    const sql = await migrationSql();

    expect(sql).toContain("create or replace function public.change_security_finding_work");
    expect(sql).toMatch(/change_security_finding_work[\s\S]*security definer[\s\S]*set search_path = ''/i);
    expect(sql).toContain("SECURITY_REMEDIATION_FORBIDDEN");
    expect(sql).toContain("SECURITY_REMEDIATION_ASSIGNEE_INVALID");
    expect(sql).toContain("SECURITY_REMEDIATION_NOTE_INVALID");
    expect(sql).toContain("SECURITY_REMEDIATION_FINDING_NOT_AVAILABLE");
    expect(sql).toMatch(/from public\.workspace_members[\s\S]*role::text/i);
    expect(sql).toMatch(/from public\.security_findings[\s\S]*for update/i);
    expect(sql).toMatch(/from public\.security_finding_work[\s\S]*for update/i);
    expect(sql).toContain("finding.assignment_changed");
    expect(sql).toContain("finding.remediation_note_updated");
    expect(sql).toMatch(/revoke all on function public\.change_security_finding_work[\s\S]*from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.change_security_finding_work[\s\S]*to service_role/i);
  });

  it("requests retests atomically from locked canonical state", async () => {
    const sql = await migrationSql();

    expect(sql).toContain("create or replace function public.request_security_finding_retest");
    expect(sql).toMatch(/request_security_finding_retest[\s\S]*security definer[\s\S]*set search_path = ''/i);
    expect(sql).toContain("SECURITY_RETEST_STATE_INVALID");
    expect(sql).toContain("SECURITY_RETEST_UNSUPPORTED_SOURCE");
    expect(sql).toContain("SECURITY_RETEST_CONSENT_REQUIRED");
    expect(sql).toContain("SECURITY_RETEST_FORBIDDEN");
    expect(sql).toContain("SECURITY_RETEST_ACTIVE_CONFLICT");
    expect(sql).toMatch(/from public\.security_findings[\s\S]*for update/i);
    expect(sql).toContain("lifecycle_state = 'retest_pending'");
    expect(sql).toContain("'finding.retest_requested'");
    expect(sql).toContain("active_consent_granted_at");
    expect(sql).toMatch(/revoke all on function public\.request_security_finding_retest[\s\S]*from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.request_security_finding_retest[\s\S]*to service_role/i);
  });

  it("attaches one exact runtime job and derives final outcomes from locked database state", async () => {
    const sql = await migrationSql();

    expect(sql).toContain("create or replace function public.mark_security_finding_retest_running");
    expect(sql).toContain("create or replace function public.finalize_security_finding_retest");
    expect(sql).toMatch(/mark_security_finding_retest_running[\s\S]*security definer[\s\S]*set search_path = ''/i);
    expect(sql).toMatch(/finalize_security_finding_retest[\s\S]*security definer[\s\S]*set search_path = ''/i);
    expect(sql).toMatch(/from public\.security_finding_retests[\s\S]*for update/i);
    expect(sql).toMatch(/from public\.scan_jobs[\s\S]*for update/i);
    expect(sql).toContain("SECURITY_RETEST_JOB_INVALID");
    expect(sql).toContain("SECURITY_RETEST_FINALIZATION_INVALID");
    expect(sql).toContain("status = 'running'");
    expect(sql).toContain("scan_job_id = target_scan_job_id");
    expect(sql).toContain("'finding.retest_started'");
    expect(sql).toContain("from public.security_finding_occurrences");
    for (const result of [
      "still_present",
      "verified_fixed",
      "inconclusive",
      "failed",
      "cancelled",
    ]) {
      expect(sql).toContain(`'${result}'`);
    }
    expect(sql).toContain("lifecycle_state = 'verified_fixed'");
    expect(sql).toContain("'finding.retest_completed'");
    expect(sql).toMatch(/revoke all on function public\.mark_security_finding_retest_running[\s\S]*from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.mark_security_finding_retest_running[\s\S]*to service_role/i);
    expect(sql).toMatch(/revoke all on function public\.finalize_security_finding_retest[\s\S]*from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.finalize_security_finding_retest[\s\S]*to service_role/i);
  });
});
