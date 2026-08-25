import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const enumMigrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260826105900_phase_6a_worker_probe_enum.sql",
);
const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260826110000_phase_6a_worker_foundation.sql",
);

describe("Phase 6A worker lease state machine", () => {
  it("commits the internal worker job kind before using it", async () => {
    const [enumSql, sql] = await Promise.all([
      readFile(enumMigrationPath, "utf8"),
      readFile(migrationPath, "utf8"),
    ]);
    expect(enumSql).toContain("add value if not exists 'worker_foundation_probe'");
    expect(sql).not.toContain("add value if not exists 'worker_foundation_probe'");
  });

  it("exposes only narrow service-role worker mutation RPCs", async () => {
    const sql = await readFile(migrationPath, "utf8");
    for (const fn of [
      "register_worker_node",
      "disable_worker_node",
      "enqueue_foundation_worker_task",
      "claim_worker_task",
      "heartbeat_worker_attempt",
      "finalize_worker_attempt",
      "recover_expired_worker_attempts",
    ]) {
      expect(sql).toContain(`create or replace function public.${fn}`);
    }
    expect(sql.match(/security definer/gi)?.length ?? 0).toBeGreaterThanOrEqual(7);
    expect(sql.match(/set search_path = ''/g)?.length ?? 0).toBeGreaterThanOrEqual(7);
    expect(sql).toMatch(/revoke all on function public\.claim_worker_task[\s\S]*from public, anon, authenticated;/i);
    expect(sql).toMatch(/grant execute on function public\.claim_worker_task[\s\S]*to service_role;/i);
  });

  it("claims atomically with deterministic ordering and a 90 second lease", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("for update skip locked");
    expect(sql).toContain("priority desc, available_at asc, created_at asc, id asc");
    expect(sql).toContain("interval '90 seconds'");
    expect(sql).toContain("attempt_count = task_record.attempt_count + 1");
    expect(sql).toContain("gen_random_bytes(32)");
    expect(sql).toContain("digest(lease_token, 'sha256')");
  });

  it("keeps retries bounded at 15 seconds, 60 seconds, then dead letter", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("interval '15 seconds'");
    expect(sql).toContain("interval '60 seconds'");
    expect(sql).toContain("WORKER_ATTEMPTS_EXHAUSTED");
    expect(sql).toContain("state = 'dead_letter'");
  });

  it("requires exact current lease identity and lets cancellation win", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("WORKER_LEASE_INVALID");
    expect(sql).toContain("lease_expires_at <= now()");
    expect(sql).toContain("cancel_requested_at is not null");
    expect(sql).toContain("WORKER_CANCELLED");
    expect(sql).not.toMatch(/cancel_requested_at\s*=\s*null/i);
  });

  it("makes identical terminal replay idempotent and conflicting replay fail closed", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("terminal_payload_digest");
    expect(sql).toContain("WORKER_TERMINAL_CONFLICT");
    expect(sql).toContain("replayed");
  });

  it("keeps the foundation probe internal and non-networked", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("'worker_foundation_probe'::public.scan_job_kind");
    expect(sql).toContain("'foundation_no_egress_v1'");
    expect(sql).toContain("request_count");
    expect(sql).toContain("redirect_count");
    expect(sql).not.toContain("http-observation");
    expect(sql).not.toContain("cors-policy");
  });
});
