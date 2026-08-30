import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  "supabase/migrations/20260831010100_phase_6d_runtime_worker_control.sql",
);
const hardeningMigrationPath = path.resolve(
  "supabase/migrations/20260831010110_phase_6d_runtime_worker_control_hardening.sql",
);

async function readControlSql(): Promise<string> {
  const [base, hardening] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(hardeningMigrationPath, "utf8"),
  ]);
  return `${base}\n${hardening}`;
}

function functionSql(sql: string, name: string): string {
  const matches = Array.from(sql.matchAll(new RegExp(
    `create or replace function public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`,
    "gi",
  )));
  expect(matches.length).toBeGreaterThan(0);
  return matches.at(-1)?.[0] ?? "";
}

describe("Phase 6D runtime worker control migration", () => {
  it("registers only the two fixed Phase 6D worker classes", async () => {
    const sql = await readControlSql();
    expect(sql).toMatch(/create or replace function public\.register_passive_runtime_worker_node\(\s*target_credential_hash text,\s*target_software_version text\s*\)/i);
    expect(sql).toMatch(/create or replace function public\.register_active_cors_worker_node\(\s*target_credential_hash text,\s*target_software_version text\s*\)/i);
    expect(sql).toContain("'passive_runtime_observation_v1'");
    expect(sql).toContain("'active_cors_validation_v1'");
  });

  it("enqueues only live Phase 4 jobs with the exact class pairing", async () => {
    const sql = await readControlSql();
    const passive = functionSql(sql, "enqueue_passive_runtime_worker_task");
    const active = functionSql(sql, "enqueue_active_cors_worker_task");

    expect(passive).toMatch(/job_record\.job_kind <> 'passive_runtime'::public\.scan_job_kind/i);
    expect(active).toMatch(/job_record\.job_kind <> 'active_validation'::public\.scan_job_kind/i);
    for (const body of [passive, active]) {
      expect(body).toMatch(/job_record\.status <> 'queued'::public\.scan_job_status/i);
      expect(body).toMatch(/job_record\.cancel_requested_at is not null/i);
      expect(body).toMatch(/job_record\.requested_by is distinct from target_actor_id/i);
      expect(body).toContain("private.runtime_worker_tasks");
      expect(body).toMatch(/active_task\.absolute_deadline_at > request_now/i);
      expect(body).toMatch(/active_job\.cancel_requested_at is null/i);
      expect(body).toMatch(/active_job\.status in \('queued'::public\.scan_job_status, 'running'::public\.scan_job_status\)/i);
    }
  });

  it("claims only Phase 6D classes and leaves the domain job queued for preparation reauthorization", async () => {
    const sql = await readControlSql();
    const claimSql = functionSql(sql, "claim_runtime_worker_task");
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
    const sql = await readControlSql();
    const prepareSql = functionSql(sql, "get_runtime_worker_preparation_context");
    expect(prepareSql).toMatch(/lease_token_hash <> calculated_hash/i);
    expect(prepareSql).toMatch(/attempt_record\.lease_expires_at <= lookup_now/i);
    expect(prepareSql).toMatch(/task_record\.absolute_deadline_at <= lookup_now/i);
    expect(prepareSql).toMatch(/task_record\.state <> 'leased'/i);
    expect(prepareSql).toContain("'domainJobId'");
    expect(prepareSql).toContain("'workspaceId'");
    expect(prepareSql).toContain("'assetId'");
    expect(prepareSql).toContain("'domainJobKind'");
    expect(prepareSql).toContain("'absoluteDeadlineAt'");
    for (const forbidden of ["canonicalUrl", "hostname", "ip", "method", "headers", "body", "origin", "userAgent"]) {
      expect(prepareSql).not.toContain(`'${forbidden}'`);
    }
  });

  it("keeps all Phase 6D control RPCs service-role-only with empty search paths", async () => {
    const sql = await readControlSql();
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
