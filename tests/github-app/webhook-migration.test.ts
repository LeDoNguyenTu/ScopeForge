import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  "supabase/migrations/20260912020000_phase_10a3_github_webhook_reconciliation.sql",
);
const repositoryIdentityOverlayPath = path.resolve(
  "supabase/migrations/20260912021000_phase_10a3_repository_asset_identity_reconciliation.sql",
);

async function migrationSource(): Promise<string> {
  return existsSync(migrationPath) ? readFile(migrationPath, "utf8") : "";
}

async function repositoryIdentityOverlaySource(): Promise<string> {
  return existsSync(repositoryIdentityOverlayPath)
    ? readFile(repositoryIdentityOverlayPath, "utf8")
    : "";
}

const publicRpcs = [
  "admit_github_webhook_delivery",
  "get_github_webhook_repository_context",
  "record_github_webhook_push_head",
  "enqueue_github_webhook_project_snapshot",
  "record_github_webhook_delivery_result",
  "reconcile_github_webhook_connection_state",
  "reconcile_github_webhook_repository_state",
  "complete_github_webhook_project_scan",
] as const;

describe("Phase 10A3 GitHub webhook reconciliation migration", () => {
  it("adds private replay/coalescing state and explicit automatic trigger provenance", async () => {
    const sql = await migrationSource();
    expect(sql).toContain("create table private.github_webhook_deliveries");
    expect(sql).toContain("create table private.github_repository_auto_scan_state");
    expect(sql).toContain("alter table private.github_project_scan_intents");
    expect(sql).toContain("trigger_kind");
    expect(sql).toContain("trigger_delivery_id");
    expect(sql).toContain("trigger_commit_sha");
    expect(sql).toContain("'manual'");
    expect(sql).toContain("'github_webhook'");
    expect(sql).toContain("desired_commit_sha");
    expect(sql).toContain("successful_commit_sha");
    expect(sql).toContain("latest_delivery_id");
    expect(sql).toContain("provider_archived");
    expect(sql).toMatch(/delivery_id\s+uuid\s+primary key/i);
    expect(sql).toMatch(/'\^\[a-f0-9\]\{40\}\$'/);
  });

  it("keeps replay/coalescing tables private with RLS and no browser table grants", async () => {
    const sql = (await migrationSource()).replace(/\s+/g, " ");
    for (const table of ["github_webhook_deliveries", "github_repository_auto_scan_state"]) {
      expect(sql).toContain(`alter table private.${table} enable row level security`);
      expect(sql).toContain(`revoke all on table private.${table} from public, anon, authenticated, service_role`);
      expect(sql).not.toContain(`grant select on table private.${table} to authenticated`);
      expect(sql).not.toContain(`grant insert on table private.${table} to authenticated`);
    }
  });

  it("persists no webhook/provider credential or raw-payload capability columns", async () => {
    const sql = await migrationSource();
    for (const forbiddenColumn of [
      "token",
      "secret",
      "signature",
      "raw_payload",
      "archive_url",
      "authorization",
      "source_body",
    ]) {
      expect(sql).not.toMatch(new RegExp(`^\\s*${forbiddenColumn}\\s+`, "im"));
    }
  });

  it("defines every reconciliation entry point as locked-down service-role authority", async () => {
    const sql = await migrationSource();
    const normalized = sql.replace(/\s+/g, " ");

    for (const fn of publicRpcs) {
      expect(normalized).toContain(`create or replace function public.${fn}`);
      const start = normalized.indexOf(`create or replace function public.${fn}`);
      const next = normalized.indexOf("create or replace function public.", start + 1);
      const segment = normalized.slice(start, next === -1 ? normalized.length : next);
      expect(segment).toContain("security definer");
      expect(segment).toContain("set search_path = ''");
      expect(segment).toMatch(new RegExp(`revoke all on function public\\.${fn}\\([^;]+\\) from public, anon, authenticated, service_role`));
      expect(segment).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^;]+\\) to service_role`));
      expect(segment).not.toMatch(/grant execute on function [^;]+ to (?:anon|authenticated)/);
    }
  });

  it("serializes desired-head updates and scan completion before deciding semantic replays", async () => {
    const sql = await migrationSource();
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("for update");
    expect(sql).toContain("desired_commit_sha");
    expect(sql).toContain("successful_commit_sha");
    expect(sql).toContain("replayed");
    expect(sql).toContain("followUpRequired");
    expect(sql).toContain("desiredCommitSha");
  });

  it("keeps system-triggered scans distinct from manual browser authorization", async () => {
    const sql = await migrationSource();
    expect(sql).toContain("trigger_kind = 'github_webhook'");
    expect(sql).toContain("trigger_delivery_id");
    expect(sql).toContain("trigger_commit_sha");
    expect(sql).toContain("auto_scan_enabled");
    expect(sql).toContain("installed_by");
    expect(sql).not.toContain("auth.uid()");
  });

  it("reconciles repository-link identity and the linked repository asset atomically", async () => {
    const segment = (await repositoryIdentityOverlaySource()).replace(/\s+/g, " ");

    expect(segment).toContain("create or replace function public.reconcile_github_webhook_repository_state");
    expect(segment).toContain("asset_record public.assets%rowtype");
    expect(segment).toMatch(/select \* into asset_record from public\.assets where id = link_record\.asset_id and workspace_id = connection_record\.workspace_id for update/);
    expect(segment).toContain("asset_record.kind <> 'repository'::public.asset_kind");
    expect(segment).toContain("asset_record.canonical_target <> link_record.html_url");
    expect(segment).toMatch(/update public\.assets set canonical_target = target_html_url, updated_at = now\(\) where id = asset_record\.id and workspace_id = connection_record\.workspace_id/);
    expect(segment).toMatch(/revoke all on function public\.reconcile_github_webhook_repository_state\([^;]+\) from public, anon, authenticated, service_role/);
    expect(segment).toMatch(/grant execute on function public\.reconcile_github_webhook_repository_state\([^;]+\) to service_role/);
  });
});