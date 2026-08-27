import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  "supabase/migrations/20260827020400_phase_6c_repository_scan_worker_control.sql",
);

describe("Phase 6C isolated worker control migration", () => {
  it("claims only the fixed Phase 6C class and returns immutable snapshot metadata without storage authority", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/create or replace function public\.claim_repository_scan_worker_task\(\s*target_worker_id uuid\s*\)/i);
    expect(sql).toContain("phase3_repository_scan_no_egress_v1");
    expect(sql).toContain("'repository_scan'::public.scan_job_kind");
    expect(sql).toContain("scopeforge-worker-claim-v1");
    expect(sql).toMatch(/state in \('queued', 'retry_wait'\)/i);
    expect(sql).toMatch(/absolute_deadline_at > claim_now/i);
    expect(sql).toMatch(/cancel_requested_at is null/i);
    expect(sql).toMatch(/attempt_record\.lease_expires_at/i);
    expect(sql).toContain("'phase3_repository_scan'");
    for (const allowed of [
      "snapshotId",
      "canonicalRepositoryUrl",
      "resolvedCommitSha",
      "contentDigest",
      "artifactDigest",
      "storedArtifactBytes",
      "retainedFileCount",
      "retainedBytes",
      "scannerProfileId",
      "scannerProfileVersion",
    ]) expect(sql).toContain(`'${allowed}'`);
    for (const forbidden of ["objectKey", "artifactUrl", "downloadUrl", "command", "image", "environment"]) {
      expect(sql).not.toContain(`'${forbidden}'`);
    }
  });

  it("requires the selected snapshot artifact to remain active through the task deadline", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/snapshot_record\.expires_at >= task_record\.absolute_deadline_at/i);
    expect(sql).toMatch(/artifact_record\.expires_at >= task_record\.absolute_deadline_at/i);
    expect(sql).toMatch(/artifact_record\.deletion_status <> 'active'/i);
    expect(sql).toMatch(/artifact_record\.deleted_at is not null/i);
    expect(sql).toMatch(/artifact_record\.stored_byte_count <> snapshot_record\.stored_artifact_bytes/i);
    expect(sql).toMatch(/artifact_record\.artifact_digest <> snapshot_record\.artifact_digest/i);
  });

  it("finalizes only failed or cancelled Phase 6C attempts and preserves retry/dead-letter semantics", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/create or replace function public\.finalize_repository_scan_worker_failure\(/i);
    expect(sql).toMatch(/target_terminal_outcome not in \('failed', 'cancelled'\)/i);
    expect(sql).toContain("REPOSITORY_SCAN_PUBLICATION_REQUIRED");
    expect(sql).toContain("REPOSITORY_SCAN_ARTIFACT_UNAVAILABLE");
    expect(sql).toContain("REPOSITORY_SCAN_ARTIFACT_INTEGRITY_FAILED");
    expect(sql).toContain("REPOSITORY_SCAN_SNAPSHOT_INVALID");
    expect(sql).toContain("REPOSITORY_SCAN_SANDBOX_FAILED");
    expect(sql).toContain("REPOSITORY_SCAN_SCANNER_FAILED");
    expect(sql).toContain("REPOSITORY_SCAN_OUTPUT_INVALID");
    expect(sql).toContain("interval '15 seconds'");
    expect(sql).toContain("interval '60 seconds'");
    expect(sql).toContain("retry_wait");
    expect(sql).toContain("dead_letter");
    expect(sql).not.toMatch(/insert\s+into\s+public\.security_findings/i);
    expect(sql).not.toMatch(/insert\s+into\s+public\.repository_scan_runs/i);
  });

  it("keeps both control RPCs service-role-only", async () => {
    const sql = await readFile(migrationPath, "utf8");
    for (const signature of [
      "public.claim_repository_scan_worker_task(uuid)",
      "public.finalize_repository_scan_worker_failure(uuid, uuid, uuid, text, text, text, text, integer, integer, bigint, bigint, bigint)",
    ]) {
      expect(sql).toContain(`revoke all on function ${signature}`);
      expect(sql).toContain(`grant execute on function ${signature}`);
    }
    expect(sql).toMatch(/set search_path = ''/i);
  });
});