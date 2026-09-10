import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260911100000_phase_10a2_private_repository_snapshot.sql",
);

describe("Phase 10A2 private repository snapshot persistence migration", () => {
  it("adds the private worker class without weakening existing classes", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("repository_snapshot_github_private_v1");
    expect(sql).toContain("repository_snapshot_github_public_v1");
    expect(sql).toContain("phase3_repository_scan_no_egress_v1");
    expect(sql).toContain("passive_runtime_observation_v1");
    expect(sql).toContain("active_cors_validation_v1");
  });

  it("persists only stable link metadata for private source authorization", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("github_repository_link_id");
    expect(sql).toContain("github_private_archive");
    expect(sql).toContain("github_public_archive");
    expect(sql).not.toMatch(/add column\s+(?:installation_?token|access_?token|archive_?url|authorization|client_?secret|private_?key)/i);
  });

  it("provides private registration/enqueue and class-aware claim through privileged RPCs", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("create or replace function public.register_private_repository_snapshot_worker_node");
    expect(sql).toContain("create or replace function public.enqueue_private_repository_snapshot_worker_task");
    expect(sql).toContain("create or replace function public.claim_worker_task");
    expect(sql).toContain("public.github_repository_links");
    expect(sql).toContain("public.github_connections");
    expect(sql).toContain("'repository_snapshot_github_private_v1'");
    expect(sql).toContain("'repository_snapshot_github_private'");
  });

  it("derives private immutable-snapshot provenance from the trusted execution class", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("create or replace function public.finalize_repository_snapshot_worker_attempt");
    expect(sql).toContain("github_private_archive");
    expect(sql).toMatch(/execution_class[\s\S]{0,500}repository_snapshot_github_private_v1/i);
    expect(sql).toMatch(/source_kind[\s\S]{0,500}github_private_archive/i);
  });

  it("keeps every new public SECURITY DEFINER entry point service-role only", async () => {
    const sql = await readFile(migrationPath, "utf8");
    for (const signature of [
      "public.register_private_repository_snapshot_worker_node(text, text)",
      "public.enqueue_private_repository_snapshot_worker_task(uuid, uuid, uuid, uuid)",
    ]) {
      expect(sql).toContain(`revoke all on function ${signature}`);
      expect(sql).toContain(`grant execute on function ${signature} to service_role`);
    }
  });
});
