import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  "supabase/migrations/20260919010000_phase_11c_http_worker_control.sql",
);

async function readMigration(): Promise<string> {
  return readFile(migrationPath, "utf8");
}

function functionSql(sql: string, name: string): string {
  const matches = Array.from(sql.matchAll(new RegExp(
    `create or replace function public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`,
    "gi",
  )));
  expect(matches.length).toBeGreaterThan(0);
  return matches.at(-1)?.[0] ?? "";
}

describe("Phase 11C HTTP worker control migration", () => {
  it("adds a private immutable, authorization-unique worker binding", async () => {
    const sql = await readMigration();
    expect(sql).toMatch(/create table private\.phase11_http_worker_tasks/i);
    expect(sql).toMatch(/task_id uuid primary key references private\.worker_tasks\(id\) on delete cascade/i);
    expect(sql).toMatch(/unique \(authorization_id\)/i);
    expect(sql).toMatch(/foreign key \(workspace_id, run_id, action_id\)[\s\S]*?private\.pentest_actions/i);
    expect(sql).toMatch(/foreign key \(workspace_id, run_id, target_node_id\)[\s\S]*?private\.pentest_graph_nodes/i);
    expect(sql).toContain("phase11_http_worker_tasks_guard_update");
    expect(sql).toContain("Phase 11 HTTP worker task bindings are immutable");
    expect(sql).toMatch(/alter table private\.phase11_http_worker_tasks enable row level security/i);
    expect(sql).toMatch(/revoke all on table private\.phase11_http_worker_tasks from public, anon, authenticated, service_role/i);
  });

  it("extends worker tasks only for the closed Phase 11 execution class", async () => {
    const sql = await readMigration();
    expect(sql).toContain("'phase11_http_discovery_v1'");
    expect(sql).toMatch(/worker_tasks_phase11_domain_check[\s\S]*?execution_class = 'phase11_http_discovery_v1'[\s\S]*?scan_job_id is null[\s\S]*?asset_id is null/i);
    expect(sql).toMatch(/worker_tasks_phase11_single_attempt_check[\s\S]*?max_attempts = 1/i);
    expect(sql).toMatch(/worker_tasks_phase11_deadline_check[\s\S]*?interval '30 seconds'/i);
  });

  it("queues from authoritative Phase 11 state with no caller-supplied target or policy", async () => {
    const sql = await readMigration();
    const enqueue = functionSql(sql, "enqueue_phase11_http_worker_task");
    expect(enqueue).toMatch(/target_workspace_id uuid,\s*target_run_id uuid,\s*target_action_id text,\s*target_authorization_id text/i);
    for (const forbidden of [
      "target_url", "target_hostname", "target_path", "target_headers", "target_method",
      "target_provider", "target_execution_class", "target_network_policy", "target_max_requests",
      "target_max_runtime_ms", "target_authorization_expires_at",
    ]) expect(enqueue).not.toContain(forbidden);
    expect(enqueue).toMatch(/from private\.pentest_runs[\s\S]*?for update/i);
    expect(enqueue).toMatch(/from private\.pentest_actions[\s\S]*?for update/i);
    expect(enqueue).toMatch(/from private\.pentest_run_authorization_snapshots/i);
    expect(enqueue).toMatch(/from private\.pentest_graph_nodes/i);
    expect(enqueue).toContain("PHASE11_HTTP_ACTION_NOT_ENQUEUEING");
    expect(enqueue).toContain("PHASE11_HTTP_AUTHORIZATION_EXPIRED");
    expect(enqueue).toContain("PHASE11_HTTP_TARGET_OUTSIDE_AUTHORIZATION");
    expect(enqueue).toContain("PHASE11_HTTP_CLOSED_PARAMETERS_INVALID");
    expect(enqueue).toContain("PHASE11_HTTP_WORKER_IDENTITY_CONFLICT");
    expect(enqueue).toMatch(/insert into private\.worker_tasks[\s\S]*?'phase11_http_discovery_v1'/i);
    expect(enqueue).toMatch(/insert into private\.phase11_http_worker_tasks/i);
    expect(enqueue).toMatch(/existing_binding\.task_id is not null[\s\S]*?'replayed', true/i);
    expect(enqueue).toMatch(/action_record\.queue_reference is distinct from[\s\S]*?'phase11-http-worker:'/i);
    expect(enqueue).toMatch(/set state = 'queued',[\s\S]*?enqueue_token = null,[\s\S]*?queue_reference = 'phase11-http-worker:'/i);
  });

  it("keeps the queue RPC service-role-only with a pinned search path", async () => {
    const sql = await readMigration();
    const enqueue = functionSql(sql, "enqueue_phase11_http_worker_task");
    expect(enqueue).toMatch(/security definer\s+set search_path = ''/i);
    const compact = sql.replace(/\s+/g, " ").toLowerCase();
    const signature = "public.enqueue_phase11_http_worker_task(uuid, uuid, text, text)";
    expect(compact).toContain(`revoke all on function ${signature} from public, anon, authenticated, service_role;`);
    expect(compact).toContain(`grant execute on function ${signature} to service_role;`);
  });

  it("loads preparation state only for the exact live worker lease", async () => {
    const sql = await readMigration();
    const prepare = functionSql(sql, "get_phase11_http_worker_preparation_context");
    expect(prepare).toMatch(/target_worker_id uuid,\s*target_task_id uuid,\s*target_attempt_id uuid,\s*target_lease_token text/i);
    expect(prepare).toMatch(/extensions\.digest\(decode\(target_lease_token, 'hex'\), 'sha256'\)/i);
    expect(prepare).toMatch(/worker_record\.execution_class <> 'phase11_http_discovery_v1'/i);
    expect(prepare).toMatch(/task_record\.execution_class <> 'phase11_http_discovery_v1'/i);
    expect(prepare).toMatch(/task_record\.state <> 'leased'/i);
    expect(prepare).toMatch(/attempt_record\.worker_id is distinct from target_worker_id/i);
    expect(prepare).toMatch(/attempt_record\.lease_token_hash is distinct from calculated_hash/i);
    expect(prepare).toMatch(/from private\.pentest_runs[\s\S]*?for update/i);
    expect(prepare).toMatch(/from private\.pentest_actions[\s\S]*?for update/i);
    expect(prepare).toContain("PHASE11_HTTP_AUTHORIZATION_EXPIRED");
    expect(prepare).toContain("'binding'");
    expect(prepare).toContain("'snapshot'");
    expect(prepare).toContain("'targetNode'");

    const compact = sql.replace(/\s+/g, " ").toLowerCase();
    const signature = "public.get_phase11_http_worker_preparation_context(uuid, uuid, uuid, text)";
    expect(compact).toContain(`revoke all on function ${signature} from public, anon, authenticated, service_role;`);
    expect(compact).toContain(`grant execute on function ${signature} to service_role;`);
  });
});
