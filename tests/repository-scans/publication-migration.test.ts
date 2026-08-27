import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  "supabase/migrations/20260827020500_phase_6c_repository_scan_publication.sql",
);

describe("Phase 6C repository scan publication migration", () => {
  it("binds publication to the exact active worker lease, repository scan task, snapshot, job, and immutable result identity", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/create or replace function public\.finalize_repository_scan_success\(/i);
    expect(sql).toContain("phase3_repository_scan_no_egress_v1");
    expect(sql).toContain("repository_scan'::public.scan_job_kind");
    expect(sql).toMatch(/attempt_record\.worker_id <> target_worker_id/i);
    expect(sql).toMatch(/attempt_record\.lease_token_hash <> calculated_hash/i);
    expect(sql).toMatch(/attempt_record\.finished_at is not null/i);
    expect(sql).toMatch(/attempt_record\.lease_expires_at <= publication_now/i);
    expect(sql).toMatch(/scan_task\.snapshot_id <> target_snapshot_id/i);
    expect(sql).toMatch(/snapshot_record\.resolved_commit_sha <> target_resolved_commit_sha/i);
    expect(sql).toMatch(/snapshot_record\.content_digest <> target_snapshot_content_digest/i);
    expect(sql).toMatch(/target_result_digest !~ '\^\[a-f0-9\]\{64\}\$'/i);
  });

  it("checks cancellation before inserting run/finding state and supports exact replay only", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const cancellation = sql.indexOf("cancel_requested_at is not null");
    const runInsert = sql.indexOf("insert into public.repository_scan_runs");
    expect(cancellation).toBeGreaterThan(-1);
    expect(runInsert).toBeGreaterThan(cancellation);
    expect(sql).toContain("REPOSITORY_SCAN_TERMINAL_CONFLICT");
    expect(sql).toContain("'replayed', true");
    expect(sql).toContain("'replayed', false");
    expect(sql).not.toContain("persist_phase3_import_result");
    expect(sql).not.toContain("phase3_import'::public.scan_job_kind");
  });

  it("keeps the publication entrypoint service-role-only and canonical writes inside one security-definer transaction", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/language plpgsql\s+security definer\s+set search_path = ''/i);
    expect(sql).toMatch(/revoke all on function public\.finalize_repository_scan_success[\s\S]*from public, anon, authenticated, service_role/i);
    expect(sql).toMatch(/grant execute on function public\.finalize_repository_scan_success[\s\S]*to service_role/i);
    expect(sql).toContain("insert into public.security_findings");
    expect(sql).toContain("insert into public.security_evidence");
    expect(sql).toContain("insert into public.security_finding_occurrences");
  });
});
