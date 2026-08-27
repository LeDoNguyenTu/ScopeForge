import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  "supabase/migrations/20260827020200_phase_6c_repository_scan_enqueue.sql",
);

describe("Phase 6C repository scan enqueue migration", () => {
  it("accepts workspace asset and actor only, never a caller-selected snapshot or execution profile", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/create or replace function public\.enqueue_repository_scan_worker_task\(\s*target_workspace_id uuid,\s*target_asset_id uuid,\s*target_actor_id uuid\s*\)/i);
    expect(sql).not.toMatch(/target_snapshot_id/i);
    expect(sql).not.toMatch(/target_execution_class/i);
    expect(sql).not.toMatch(/target_scanner/i);
    expect(sql).not.toMatch(/target_budget/i);
    expect(sql).not.toMatch(/target_image/i);
  });

  it("requires owner or admin and an exact repository asset", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/role::text in \('owner', 'admin'\)/i);
    expect(sql).toMatch(/asset_record\.kind <> 'repository'::public\.asset_kind/i);
    expect(sql).toContain("REPOSITORY_SCAN_ACCESS_DENIED");
    expect(sql).toContain("REPOSITORY_SCAN_ASSET_MISMATCH");
  });

  it("selects the newest active snapshot server-side and requires at least thirty minutes of retention", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/from public\.repository_source_snapshots s[\s\S]*join private\.repository_source_artifacts a/i);
    expect(sql).toMatch(/s\.workspace_id = target_workspace_id/i);
    expect(sql).toMatch(/s\.asset_id = target_asset_id/i);
    expect(sql).toMatch(/a\.deletion_status = 'active'/i);
    expect(sql).toMatch(/a\.expires_at >= request_now \+ interval '30 minutes'/i);
    expect(sql).toMatch(/s\.expires_at >= request_now \+ interval '30 minutes'/i);
    expect(sql).toMatch(/order by s\.created_at desc, s\.id desc/i);
    expect(sql).toMatch(/limit 1/i);
    expect(sql).toContain("REPOSITORY_SCAN_SNAPSHOT_NOT_AVAILABLE");
  });

  it("enforces cooldown active-workspace and UTC daily limits under an advisory lock", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("scopeforge-repository-scan-workspace:");
    expect(sql).toMatch(/created_at > request_now - interval '5 minutes'/i);
    expect(sql).toContain("REPOSITORY_SCAN_COOLDOWN");
    expect(sql).toMatch(/status in \('queued'::public\.scan_job_status, 'running'::public\.scan_job_status\)/i);
    expect(sql).toContain("REPOSITORY_SCAN_ACTIVE_LIMIT");
    expect(sql).toMatch(/created_at >= utc_day_start/i);
    expect(sql).toMatch(/\) >= 20 then/i);
    expect(sql).toContain("REPOSITORY_SCAN_DAILY_LIMIT");
  });

  it("creates only the fixed repository scan job task and snapshot binding", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("'repository_scan'::public.scan_job_kind");
    expect(sql).toContain("'phase3_repository_scan_no_egress_v1'");
    expect(sql).toContain("request_now + interval '20 minutes'");
    expect(sql).toContain("insert into private.repository_scan_tasks");
    expect(sql).toContain("snapshot_record.id");
    expect(sql).toContain("'phase3-hosted-static-v1'");
    expect(sql).toMatch(/scanner_profile_version[\s\S]*1/i);
  });

  it("exposes enqueue only through service-role execution", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/security definer\s+set search_path = ''/i);
    expect(sql).toMatch(/revoke all on function public\.enqueue_repository_scan_worker_task\(uuid, uuid, uuid\)[\s\S]*from public, anon, authenticated, service_role/i);
    expect(sql).toMatch(/grant execute on function public\.enqueue_repository_scan_worker_task\(uuid, uuid, uuid\)[\s\S]*to service_role/i);
  });
});