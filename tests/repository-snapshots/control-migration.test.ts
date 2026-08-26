import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const controlPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260827010200_phase_6b_repository_snapshot_control.sql",
);
const publicationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260827010300_phase_6b_repository_snapshot_publication.sql",
);

describe("Phase 6B repository snapshot control authority", () => {
  it("keeps worker registration classes closed with a dedicated repository RPC", async () => {
    const sql = await readFile(controlPath, "utf8");

    expect(sql).toContain("create or replace function public.register_repository_snapshot_worker_node");
    expect(sql).toContain("'repository_snapshot_github_public_v1'");
    expect(sql).not.toMatch(/register_repository_snapshot_worker_node[\s\S]{0,500}target_execution_class/i);
  });

  it("enqueues only owner/admin repository assets with serialized quotas", async () => {
    const sql = await readFile(controlPath, "utf8");

    expect(sql).toContain("create or replace function public.enqueue_repository_snapshot_worker_task");
    expect(sql).toContain("REPOSITORY_SNAPSHOT_ACCESS_DENIED");
    expect(sql).toContain("REPOSITORY_SNAPSHOT_ASSET_MISMATCH");
    expect(sql).toContain("REPOSITORY_SNAPSHOT_COOLDOWN");
    expect(sql).toContain("REPOSITORY_SNAPSHOT_DAILY_LIMIT");
    expect(sql).toContain("REPOSITORY_SNAPSHOT_ACTIVE_LIMIT");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("role::text in ('owner', 'admin')");
    expect(sql).toContain("kind = 'repository'::public.asset_kind");
    expect(sql).toContain("interval '5 minutes'");
    expect(sql).toContain("interval '20 minutes'");
    expect(sql).toContain("repository_snapshot_github_public_v1");
    expect(sql).not.toMatch(/target_(url|branch|ref|sha|header|command|budget|execution_class|network_policy)/i);
  });

  it("makes claim class-aware and creates one opaque attempt object key", async () => {
    const sql = await readFile(controlPath, "utf8");

    expect(sql).toContain("create or replace function public.claim_worker_task");
    expect(sql).toContain("j.job_kind = 'repository_snapshot'::public.scan_job_kind");
    expect(sql).toContain("private.repository_snapshot_attempt_uploads");
    expect(sql).toContain("extensions.gen_random_bytes(32)");
    expect(sql).toContain("artifactObjectKey");
    expect(sql).toContain("repository-source/");
    expect(sql).toContain("foundation_probe");
  });

  it("adds a lease-bound artifact lookup and dedicated publication RPC", async () => {
    const controlSql = await readFile(controlPath, "utf8");
    const publicationSql = await readFile(publicationPath, "utf8");

    expect(controlSql).toContain("create or replace function public.get_repository_snapshot_attempt_artifact");
    expect(controlSql).toContain("WORKER_LEASE_INVALID");
    expect(publicationSql).toContain("create or replace function public.finalize_repository_snapshot_worker_attempt");
    expect(publicationSql).toContain("REPOSITORY_SNAPSHOT_TERMINAL_INVALID");
    expect(publicationSql).toContain("REPOSITORY_SNAPSHOT_TERMINAL_CONFLICT");
    expect(publicationSql).toContain("repository_source_snapshots");
    expect(publicationSql).toContain("repository_source_artifacts");
    expect(publicationSql).toContain("cancel_requested_at");
  });

  it("forces repository success through publication instead of the generic finalizer", async () => {
    const sql = await readFile(publicationPath, "utf8");

    expect(sql).toContain("REPOSITORY_SNAPSHOT_PUBLICATION_REQUIRED");
    expect(sql).toMatch(/execution_class = 'repository_snapshot_github_public_v1'[\s\S]*target_terminal_outcome = 'succeeded'[\s\S]*REPOSITORY_SNAPSHOT_PUBLICATION_REQUIRED/i);
    expect(sql).toContain("target_server_observed_object_bytes <> target_stored_artifact_bytes");
  });

  it("keeps all public mutation RPCs service-role-only with an empty search path", async () => {
    const sql = `${await readFile(controlPath, "utf8")}\n${await readFile(publicationPath, "utf8")}`;

    for (const signature of [
      "register_repository_snapshot_worker_node(text, text)",
      "enqueue_repository_snapshot_worker_task(uuid, uuid, uuid)",
      "get_repository_snapshot_attempt_artifact(uuid, uuid, uuid, text)",
    ]) {
      expect(sql).toContain(`revoke all on function public.${signature}`);
      const escaped = signature.replace(/[()]/g, (match) => `\\${match}`);
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${escaped}\\s+to service_role`, "i"));
    }
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("revoke all on function public.finalize_repository_snapshot_worker_attempt");
    expect(sql).toMatch(/grant execute on function public\.finalize_repository_snapshot_worker_attempt[\s\S]*to service_role/i);
  });
});
