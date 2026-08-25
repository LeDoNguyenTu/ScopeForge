import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260825062000_phase_5a_hosted_finding_foundation.sql",
);

async function migrationSql(): Promise<string> {
  return readFile(migrationPath, "utf8");
}

const expectedTables = [
  "security_findings",
  "security_evidence",
  "security_finding_evidence",
  "security_finding_occurrences",
  "security_finding_events",
] as const;

const trustedFunctions = [
  "persist_passive_runtime_result",
  "persist_active_validation_result",
  "change_security_finding_lifecycle",
] as const;

function functionSection(sql: string, functionName: string): string {
  const start = sql.indexOf(`create or replace function public.${functionName}(`);
  expect(start, functionName).toBeGreaterThanOrEqual(0);
  const nextPublic = sql.indexOf("create or replace function public.", start + 1);
  return sql.slice(start, nextPublic === -1 ? undefined : nextPublic);
}

describe("Phase 5A hosted finding migration", () => {
  it("creates one canonical workspace-scoped ledger", async () => {
    const sql = await migrationSql();

    for (const table of expectedTables) {
      expect(sql).toContain(`create table public.${table}`);
    }

    expect(sql).not.toMatch(
      /create table public\.(?:runtime_findings|active_findings|passive_findings)/i,
    );
    expect(sql).toContain("primary key (workspace_id, finding_id)");
    expect(sql).toContain("primary key (workspace_id, evidence_id)");
    expect(sql).toContain("unique (workspace_id, finding_id, scan_job_id)");
  });

  it("keeps authenticated browser access select-only", async () => {
    const sql = await migrationSql();

    for (const table of expectedTables) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`grant select on table public.${table} to authenticated`);
    }

    expect(sql).not.toMatch(
      /grant\s+(?:insert|update|delete)\s+on\s+table\s+public\.security_/i,
    );
  });

  it("preserves workspace and asset integrity", async () => {
    const sql = await migrationSql();

    expect(sql).toContain(
      "foreign key (asset_id, workspace_id) references public.assets(id, workspace_id)",
    );
    expect(sql).toContain(
      "foreign key (last_seen_job_id, workspace_id, asset_id) references public.scan_jobs(id, workspace_id, asset_id)",
    );
    expect(sql).toContain(
      "foreign key (scan_job_id, workspace_id, asset_id) references public.scan_jobs(id, workspace_id, asset_id)",
    );
  });

  it("makes evidence and history immutable or append-only", async () => {
    const sql = await migrationSql();

    expect(sql).toContain("Finding history rows are append-only");
    expect(sql).toContain("Evidence rows are immutable");
    expect(sql).toContain("security_finding_events_scan_event_unique");
  });

  it("bounds evidence, event reasons, and event metadata", async () => {
    const sql = await migrationSql();

    expect(sql).toContain("char_length(summary) between 1 and 4096");
    expect(sql).toContain("reason is null or char_length(reason) <= 1000");
    expect(sql).toContain("pg_column_size(metadata) <= 8192");
  });

  it("changes user lifecycle state and history in one service-role-only transaction", async () => {
    const sql = await migrationSql();
    const functionStart = sql.indexOf("create or replace function public.change_security_finding_lifecycle");
    expect(functionStart).toBeGreaterThanOrEqual(0);
    const functionEnd = sql.indexOf(
      "revoke all on function public.change_security_finding_lifecycle",
      functionStart,
    );
    expect(functionEnd).toBeGreaterThan(functionStart);
    const lifecycleFunction = sql.slice(functionStart, functionEnd);

    expect(lifecycleFunction).toContain("for update");
    expect(lifecycleFunction).toContain("expected_lifecycle");
    expect(lifecycleFunction).toContain("next_lifecycle");
    expect(lifecycleFunction).toContain("finding.lifecycle_changed");
    expect(lifecycleFunction).toContain("update public.security_findings");
    expect(lifecycleFunction).toContain("insert into public.security_finding_events");
    expect(lifecycleFunction).toContain("set search_path = ''");
    expect(sql).toMatch(
      /revoke all on function public\.change_security_finding_lifecycle[\s\S]*from public, anon, authenticated/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.change_security_finding_lifecycle[\s\S]*to service_role/i,
    );
  });

  it("keeps every public mutation RPC security-definer, search-path pinned, and service-role only", async () => {
    const sql = await migrationSql();

    for (const functionName of trustedFunctions) {
      const section = functionSection(sql, functionName);
      expect(section, functionName).toContain("security definer");
      expect(section, functionName).toContain("set search_path = ''");
      expect(section, functionName).toContain(`revoke all on function public.${functionName}`);
      expect(section, functionName).toContain("from public, anon, authenticated");
      expect(section, functionName).toContain(`grant execute on function public.${functionName}`);
      expect(section, functionName).toContain("to service_role");
      expect(section, functionName).not.toMatch(/grant execute[\s\S]*to authenticated/i);
    }
  });

  it("does not introduce raw response or credential storage columns", async () => {
    const sql = await migrationSql();
    expect(sql).not.toMatch(/\b(response_body|raw_headers|cookie_value|authorization_header|credential_value)\b/i);
  });
});
