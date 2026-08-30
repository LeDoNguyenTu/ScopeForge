import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  "supabase/migrations/20260831010100_phase_6d_runtime_worker_control.sql",
);

describe("Phase 6D runtime worker control migration", () => {
  it("registers only the two fixed Phase 6D worker classes", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/create or replace function public\.register_passive_runtime_worker_node\(\s*target_credential_hash text,\s*target_software_version text\s*\)/i);
    expect(sql).toMatch(/create or replace function public\.register_active_cors_worker_node\(\s*target_credential_hash text,\s*target_software_version text\s*\)/i);
    expect(sql).toContain("'passive_runtime_observation_v1'");
    expect(sql).toContain("'active_cors_validation_v1'");
  });

  it("enqueues only existing queued Phase 4 jobs with the exact class pairing", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/create or replace function public\.enqueue_passive_runtime_worker_task\(/i);
    expect(sql).toMatch(/create or replace function public\.enqueue_active_cors_worker_task\(/i);
    expect(sql).toMatch(/job_record\.job_kind <> 'passive_runtime'::public\.scan_job_kind/i);
    expect(sql).toMatch(/job_record\.job_kind <> 'active_validation'::public\.scan_job_kind/i);
    expect(sql).toMatch(/job_record\.status <> 'queued'::public\.scan_job_status/i);
    expect(sql).toMatch(/job_record\.cancel_requested_at is not null/i);
    expect(sql).toContain("private.runtime_worker_tasks");
  });

  it("claims only Phase 6D classes and leaves the domain job queued for preparation reauthorization", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const claimMatch = sql.match(/create or replace function public\.claim_runtime_worker_task\([\s\S]*?\n\$\$;/i);
    expect(claimMatch).not.toBeNull();
    const claimSql = claimMatch?.[0] ?? "";
    expect(claimSql).toMatch(/execution_class in \(\s*'passive_runtime_observation_v1',\s*'active_cors_validation_v1'\s*\)/i);
    expect(claimSql).toMatch(/j\.status = 'queued'::public\.scan_job_status/i);
    expect(claimSql).toMatch(/j\.cancel_requested_at is null/i);
    expect(claimSql).toMatch(/t\.absolute_deadline_at > claim_now/i);
    expect(claimSql).toMatch(/state = 'leased'/i);
    expect(claimSql).not.toMatch(/update\s+public\.scan_jobs[\s\S]*?set\s+status\s*=\s*'running'/i);
    expect(claimSql).toContain("'domainJobId'");
    expect(claimSql).not.toContain("'canonicalUrl'");
    expect(claimSql).not.toContain("'hostname'");
    expect(claimSql).not.toContain("'headers'");
    expect(claimSql).not.toContain("'method'");
    expect(claimSql).not.toContain("'body'");
  });

  it("provides an exact-lease preparation context without target or request data", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/create or replace function public\.get_runtime_worker_preparation_context\(/i);
    expect(sql).toMatch(/lease_token_hash <> calculated_hash/i);
    expect(sql).toMatch(/attempt_record\.lease_expires_at <= lookup_now/i);
    expect(sql).toMatch(/task_record\.absolute_deadline_at <= lookup_now/i);
    expect(sql).toMatch(/task_record\.state <> 'leased'/i);
    expect(sql).toContain("'domainJobId'");
    expect(sql).toContain("'workspaceId'");
    expect(sql).toContain("'assetId'");
    expect(sql).toContain("'domainJobKind'");
    expect(sql).toContain("'absoluteDeadlineAt'");
    for (const forbidden of ["canonicalUrl", "hostname", "ip", "method", "headers", "body", "origin", "userAgent"]) {
      expect(sql).not.toContain(`'${forbidden}'`);
    }
  });

  it("keeps all Phase 6D control RPCs service-role-only with empty search paths", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const compact = sql.replace(/\s+/g, " ");
    const signatures = [
      "public.register_passive_runtime_worker_node(text, text)",
      "public.register_active_cors_worker_node(text, text)",
      "public.enqueue_passive_runtime_worker_task(uuid, uuid, uuid)",
      "public.enqueue_active_cors_worker_task(uuid, uuid, uuid)",
      "public.claim_runtime_worker_task(uuid)",
      "public.get_runtime_worker_preparation_context(uuid, uuid, uuid, text)",
    ];
    for (const signature of signatures) {
      expect(compact).toContain(`revoke all on function ${signature} from public, anon, authenticated, service_role;`);
      expect(compact).toContain(`grant execute on function ${signature} to service_role;`);
    }
    const functionCount = (sql.match(/create or replace function public\./g) ?? []).length;
    const searchPathCount = (sql.match(/set search_path = ''/g) ?? []).length;
    expect(searchPathCount).toBe(functionCount);
  });
});
