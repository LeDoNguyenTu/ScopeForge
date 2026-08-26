import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const enumPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260827010000_phase_6b_repository_snapshot_enum.sql",
);
const schemaPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260827010100_phase_6b_repository_snapshot_schema.sql",
);
const liveHardeningPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260827010500_phase_6b_repository_snapshot_live_hardening.sql",
);

describe("Phase 6B repository snapshot schema", () => {
  it("adds repository_snapshot in an enum-only migration", async () => {
    const sql = await readFile(enumPath, "utf8");
    expect(sql).toContain("alter type public.scan_job_kind");
    expect(sql).toContain("add value if not exists 'repository_snapshot'");
    expect(sql).not.toMatch(/create\s+table/i);
  });

  it("adds one public safe metadata table and private acquisition state", async () => {
    const sql = await readFile(schemaPath, "utf8");

    expect(sql).toContain("create table public.repository_source_snapshots");
    expect(sql).toContain("create table private.repository_snapshot_tasks");
    expect(sql).toContain("create table private.repository_snapshot_attempt_uploads");
    expect(sql).toContain("create table private.repository_source_artifacts");
    expect(sql).toContain("source_kind text not null default 'github_public_archive'");
    expect(sql).toContain("schema_version smallint not null default 1");
    expect(sql).toContain("resolved_commit_sha");
    expect(sql).toContain("content_digest");
    expect(sql).toContain("artifact_digest");
    expect(sql).toContain("expires_at");
  });

  it("widens only the reviewed worker execution-class checks", async () => {
    const sql = await readFile(schemaPath, "utf8");

    expect(sql).toContain("worker_nodes_execution_class_check");
    expect(sql).toContain("worker_tasks_execution_class_check");
    expect(sql).toContain("foundation_no_egress_v1");
    expect(sql).toContain("repository_snapshot_github_public_v1");
    expect(sql).not.toMatch(/execution_class\s+text\s+not\s+null\s+check\s*\(execution_class\s+not\s+in/i);
  });

  it("keeps browser roles select-only on safe metadata and outside private tables", async () => {
    const sql = await readFile(schemaPath, "utf8");

    expect(sql).toContain("alter table public.repository_source_snapshots enable row level security");
    expect(sql).toContain("repository_source_snapshots_member_select");
    expect(sql).toMatch(/grant\s+select\s+on\s+table\s+public\.repository_source_snapshots\s+to\s+authenticated/i);
    expect(sql).toMatch(/revoke\s+insert,\s*update,\s*delete\s+on\s+table\s+public\.repository_source_snapshots\s+from\s+authenticated/i);

    for (const table of [
      "repository_snapshot_tasks",
      "repository_snapshot_attempt_uploads",
      "repository_source_artifacts",
    ]) {
      expect(sql).toMatch(new RegExp(`revoke all on table private\\.${table} from public, anon, authenticated, service_role`, "i"));
    }
  });

  it("pins immutable provenance, seven-day expiry, and bounded fields", async () => {
    const sql = await readFile(schemaPath, "utf8");

    expect(sql).toContain("repository_source_snapshots_guard_update");
    expect(sql).toContain("repository_source_snapshots_guard_delete");
    expect(sql).toContain("Repository source snapshot rows are immutable");
    expect(sql).toContain("interval '7 days'");
    expect(sql).toContain("^[a-f0-9]{40}$");
    expect(sql).toContain("^[a-f0-9]{64}$");
    expect(sql).toContain("retained_file_count between 0 and 20000");
    expect(sql).toContain("stored_artifact_bytes between 1 and 335544320");
    expect(sql).toContain("octet_length(default_branch) between 1 and 255");
  });

  it("keeps repository snapshot scan jobs outside runtime and finding authority", async () => {
    const sql = await readFile(schemaPath, "utf8");

    expect(sql).toContain("scan_jobs_repository_snapshot_contract_check");
    expect(sql).toContain("job_kind <> 'repository_snapshot'");
    expect(sql).toContain("authorization_canonical_target is null");
    expect(sql).toContain("validation_profile_id is null");
    expect(sql).toContain("request_count = 0");
    expect(sql).toContain("redirect_count = 0");
    expect(sql).toContain("finding_count = 0");
  });

  it("creates covering and operational indexes for Phase 6B foreign keys and cleanup", async () => {
    const sql = await readFile(schemaPath, "utf8");

    for (const index of [
      "repository_source_snapshots_asset_workspace_idx",
      "repository_source_snapshots_job_workspace_asset_idx",
      "repository_source_snapshots_workspace_asset_created_idx",
      "repository_snapshot_tasks_asset_workspace_idx",
      "repository_snapshot_attempt_uploads_task_idx",
      "repository_source_artifacts_expiry_idx",
    ]) {
      expect(sql).toContain(index);
    }
  });

  it("removes live default service-role table authority and covers actor foreign keys", async () => {
    const sql = await readFile(liveHardeningPath, "utf8");

    expect(sql).toMatch(
      /revoke\s+all\s+on\s+table\s+public\.repository_source_snapshots\s+from\s+service_role/i,
    );
    expect(sql).toContain("repository_source_snapshots_requested_by_idx");
    expect(sql).toContain("repository_snapshot_tasks_requested_by_idx");
  });

  it("keeps cancellation authoritative when publication races a cancelled job", async () => {
    const sql = await readFile(liveHardeningPath, "utf8");

    expect(sql).toContain("finalize_repository_snapshot_worker_attempt_v1");
    expect(sql).toMatch(/set\s+schema\s+private/i);
    expect(sql).toMatch(
      /j\.cancel_requested_at\s+is\s+not\s+null[\s\S]*j\.status\s*=\s*'cancelled'::public\.scan_job_status/i,
    );
    expect(sql).toMatch(/return\s+public\.finalize_worker_attempt\([\s\S]*'cancelled'/i);
    expect(sql).toContain("return private.finalize_repository_snapshot_worker_attempt_v1(");
    expect(sql).toMatch(
      /revoke\s+all\s+on\s+function\s+private\.finalize_repository_snapshot_worker_attempt_v1[\s\S]*service_role/i,
    );
  });
});
