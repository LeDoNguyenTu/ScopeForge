import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  "supabase/migrations/20260919010000_phase_11c_http_worker_control.sql",
);

async function readMigration(): Promise<string> {
  return readFile(migrationPath, "utf8");
}

function functionSql(sql: string, name: string, schema = "public"): string {
  const matches = Array.from(sql.matchAll(new RegExp(
    `create or replace function ${schema}\\.${name}\\([\\s\\S]*?\\n\\$\\$;`,
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
    expect(enqueue).toMatch(/update public\.pentest_action_summaries[\s\S]*?set state = 'queued'/i);
  });

  it("cancels queued work immediately and leased work through authoritative heartbeat propagation", async () => {
    const sql = await readMigration();
    const cancel = functionSql(sql, "cancel_phase11_http_worker_task");
    expect(cancel).toMatch(/target_workspace_id uuid,\s*target_run_id uuid,\s*target_action_id text,\s*target_task_id uuid/i);
    expect(cancel).toMatch(/from private\.worker_tasks[\s\S]*?for update/i);
    expect(cancel).toMatch(/from private\.phase11_http_worker_tasks/i);
    expect(cancel).toMatch(/from private\.pentest_actions[\s\S]*?for update/i);
    expect(cancel).toMatch(/task_record\.state in \('queued', 'retry_wait'\)[\s\S]*?set state = 'cancelled'/i);
    expect(cancel).toMatch(/task_record\.state = 'leased'[\s\S]*?null;/i);
    expect(cancel).toMatch(/update private\.pentest_actions[\s\S]*?set state = 'cancelled'/i);
    expect(cancel).toMatch(/update public\.pentest_action_summaries[\s\S]*?set state = 'cancelled'/i);
    expect(cancel).toContain("'worker.cancel_requested'");

    const compact = sql.replace(/\s+/g, " ").toLowerCase();
    const signature = "public.cancel_phase11_http_worker_task(uuid, uuid, text, uuid)";
    expect(compact).toContain(`revoke all on function ${signature} from public, anon, authenticated, service_role;`);
    expect(compact).toContain(`grant execute on function ${signature} to service_role;`);
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

  it("registers and claims only the dedicated Phase 11 worker class", async () => {
    const sql = await readMigration();
    const register = functionSql(sql, "register_phase11_http_worker_node");
    const claim = functionSql(sql, "claim_phase11_http_worker_task");
    expect(sql).toMatch(/worker_nodes_execution_class_check[\s\S]*?'phase11_http_discovery_v1'/i);
    expect(register).toContain("'phase11_http_discovery_v1'");
    expect(claim).toMatch(/worker_record\.execution_class <> 'phase11_http_discovery_v1'/i);
    expect(claim).toMatch(/t\.execution_class = 'phase11_http_discovery_v1'/i);
    expect(claim).toMatch(/join private\.phase11_http_worker_tasks/i);
    expect(claim).toMatch(/join private\.pentest_actions/i);
    expect(claim).toMatch(/join private\.pentest_runs/i);
    expect(claim).toMatch(/join private\.pentest_run_authorization_snapshots/i);
    expect(claim).toMatch(/for update of t skip locked/i);
    expect(claim).toMatch(/insert into private\.worker_attempts/i);
    expect(claim).toMatch(/set state = 'leased',[\s\S]*?attempt_count = task_record\.attempt_count \+ 1/i);
    expect(claim).toMatch(/update private\.pentest_actions[\s\S]*?set state = 'running'/i);
    expect(claim).toMatch(/update public\.pentest_action_summaries[\s\S]*?set state = 'running'/i);
    expect(claim).toContain("'kind', 'phase11_http_discovery'");
    expect(claim).toContain("'runId', binding_record.run_id");
    expect(claim).toContain("'actionId', binding_record.action_id");
    expect(claim).toContain("'authorizationId', binding_record.authorization_id");
    for (const forbidden of ["'url'", "'hostname'", "'headers'", "'method'", "'body'"]) {
      expect(claim).not.toContain(forbidden);
    }
  });

  it("keeps Phase 11 registration and claim service-role-only", async () => {
    const sql = await readMigration();
    const compact = sql.replace(/\s+/g, " ").toLowerCase();
    for (const signature of [
      "public.register_phase11_http_worker_node(text, text)",
      "public.claim_phase11_http_worker_task(uuid)",
    ]) {
      expect(compact).toContain(`revoke all on function ${signature} from public, anon, authenticated, service_role;`);
      expect(compact).toContain(`grant execute on function ${signature} to service_role;`);
    }
  });

  it("heartbeats Phase 11 leases without requiring a legacy scan job", async () => {
    const sql = await readMigration();
    const heartbeat = functionSql(sql, "heartbeat_worker_attempt");
    expect(heartbeat).toMatch(/task_record\.execution_class = 'phase11_http_discovery_v1'[\s\S]*?from private\.phase11_http_worker_tasks/i);
    expect(heartbeat).toMatch(/from private\.pentest_runs/i);
    expect(heartbeat).toMatch(/from private\.pentest_actions/i);
    expect(heartbeat).toMatch(/from private\.pentest_run_authorization_snapshots/i);
    expect(heartbeat).toMatch(/phase11_run\.status <> 'running'[\s\S]*?phase11_action\.state <> 'running'/i);
    expect(heartbeat).toMatch(/phase11_snapshot\.expires_at <= heartbeat_now/i);
    expect(heartbeat).toMatch(/phase11_action\.authorization_expires_at <= heartbeat_now/i);

    const phase11Branch = heartbeat.match(
      /if task_record\.execution_class = 'phase11_http_discovery_v1' then([\s\S]*?)\n  else/i,
    )?.[1] ?? "";
    expect(phase11Branch.length).toBeGreaterThan(0);
    expect(phase11Branch).not.toContain("public.scan_jobs");

    const compact = sql.replace(/\s+/g, " ").toLowerCase();
    const signature = "public.heartbeat_worker_attempt(uuid, uuid, uuid, text)";
    expect(compact).toContain(`revoke all on function ${signature} from public, anon, authenticated, service_role;`);
    expect(compact).toContain(`grant execute on function ${signature} to service_role;`);
  });

  it("loads finalization authority through the exact worker lease without caller scope fields", async () => {
    const sql = await readMigration();
    const context = functionSql(sql, "get_phase11_http_worker_finalization_context");
    expect(context).toMatch(/target_worker_id uuid,\s*target_task_id uuid,\s*target_attempt_id uuid,\s*target_lease_token text/i);
    expect(context).toMatch(/extensions\.digest\(decode\(target_lease_token, 'hex'\), 'sha256'\)/i);
    expect(context).toMatch(/attempt_record\.worker_id is distinct from target_worker_id/i);
    expect(context).toContain("'authorizationSnapshotRef'");
    expect(context).toContain("'discoveryProfile'");
    expect(context).toContain("'maxRequests', action_record.max_requests");
    expect(context).toContain("'priorTerminalDigest'");
  });

  it("atomically persists normalized observations before terminalizing the Phase 11 action", async () => {
    const sql = await readMigration();
    const finalize = functionSql(sql, "finalize_phase11_http_worker_attempt");
    expect(finalize).toMatch(/target_worker_id uuid,\s*target_task_id uuid,\s*target_attempt_id uuid,\s*target_lease_token text/i);
    const signatureEnd = finalize.search(/\)\r?\nreturns/i);
    expect(signatureEnd).toBeGreaterThan(0);
    const signature = finalize.slice(0, signatureEnd);
    for (const forbidden of ["target_workspace_id", "target_run_id", "target_action_id", "target_authorization_id", "target_node_id"]) {
      expect(signature).not.toContain(forbidden);
    }
    expect(finalize).toMatch(/from private\.worker_attempts[\s\S]*?for update/i);
    expect(finalize).toMatch(/from private\.pentest_actions[\s\S]*?for update/i);
    expect(finalize).toMatch(/perform public\.persist_phase11_observations[\s\S]*?insert into private\.pentest_action_attempts[\s\S]*?update private\.pentest_actions/i);
    expect(finalize).toMatch(/update private\.pentest_actions[\s\S]*?'terminal'/i);
    expect(finalize).toMatch(/attempt_record\.terminal_payload_digest is distinct from target_terminal_digest/i);
    expect(finalize).toMatch(/action_record\.authorization_id is distinct from binding_record\.authorization_id/i);
    expect(finalize).toContain("PHASE11_HTTP_AUTHORIZATION_EXPIRED");
    expect(finalize).toMatch(/target_outcome <> 'succeeded'[\s\S]*?jsonb_array_length\(observation_rows\) <> 0/i);
    expect(finalize).not.toMatch(/target_request_count\s*:=\s*0/i);
    expect(finalize).toContain("conservative upper bound");
  });

  it("recovers unclaimed and expired Phase 11 work without legacy scan-job authority", async () => {
    const sql = await readMigration();
    const unleased = functionSql(sql, "recover_phase11_http_unleased_worker_tasks", "private");
    const leased = functionSql(sql, "recover_phase11_http_expired_worker_attempts", "private");
    const recover = functionSql(sql, "recover_worker_state");

    expect(unleased).toMatch(/private\.phase11_http_worker_tasks/i);
    expect(unleased).toMatch(/t\.execution_class = 'phase11_http_discovery_v1'/i);
    expect(unleased).not.toContain("public.scan_jobs");
    expect(unleased).toMatch(/set state = case when effective_cancelled then 'cancelled' else 'dead_letter' end/i);
    expect(unleased).toMatch(/insert into private\.pentest_action_attempts/i);
    expect(unleased).toContain("'WORKER_CLASS_UNAVAILABLE'");
    expect(unleased).toMatch(/update public\.pentest_action_summaries[\s\S]*?'terminal'/i);

    expect(leased).toMatch(/private\.phase11_http_worker_tasks/i);
    expect(leased).toMatch(/task\.execution_class = 'phase11_http_discovery_v1'/i);
    expect(leased).not.toContain("public.scan_jobs");
    expect(leased).toMatch(/attempt\.lease_expires_at <= target_now/i);
    expect(leased).toMatch(/update private\.worker_attempts[\s\S]*?'HTTP_DISCOVERY_TOTAL_TIMEOUT'/i);
    expect(leased).toMatch(/insert into private\.pentest_action_attempts[\s\S]*?'timed_out'/i);
    expect(leased).toMatch(/update private\.pentest_actions[\s\S]*?'terminal'/i);
    expect(leased).toMatch(/update public\.pentest_action_summaries[\s\S]*?'terminal'/i);

    const phase11Leased = recover.indexOf("private.recover_phase11_http_expired_worker_attempts(effective_now)");
    const legacyLeased = recover.indexOf("public.recover_expired_worker_attempts_leased_only(effective_now)");
    expect(phase11Leased).toBeGreaterThan(-1);
    expect(legacyLeased).toBeGreaterThan(phase11Leased);

    const compact = sql.replace(/\s+/g, " ").toLowerCase();
    for (const signature of [
      "private.recover_phase11_http_unleased_worker_tasks(timestamptz)",
      "private.recover_phase11_http_expired_worker_attempts(timestamptz)",
    ]) {
      expect(compact).toContain(`revoke all on function ${signature} from public, anon, authenticated, service_role;`);
    }
  });

  it("keeps finalization RPCs service-role-only", async () => {
    const sql = await readMigration();
    const compact = sql.replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").toLowerCase();
    for (const signature of [
      "public.get_phase11_http_worker_finalization_context(uuid, uuid, uuid, text)",
      "public.finalize_phase11_http_worker_attempt(uuid, uuid, uuid, text, text, text, text, integer, jsonb, jsonb)",
    ]) {
      expect(compact).toContain(`revoke all on function ${signature} from public, anon, authenticated, service_role;`);
      expect(compact).toContain(`grant execute on function ${signature} to service_role;`);
    }
  });
});
