import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const remediationDir = path.resolve(root, "lib/security-remediation");
const storyPath = path.resolve(remediationDir, "story.ts");
const migrationPath = path.resolve(
  root,
  "supabase/migrations/20260825090000_phase_5b_remediation_retest_security_story.sql",
);
const hardeningMigrationPath = path.resolve(
  root,
  "supabase/migrations/20260825091000_phase_5b_retest_recovery_hardening.sql",
);
const actionPath = path.resolve(
  root,
  "app/dashboard/findings/[findingId]/remediation-actions.ts",
);

async function collectSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectSourceFiles(target));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(target);
  }
  return files;
}

function functionBody(sql: string, name: string): string {
  const start = sql.indexOf(`create or replace function public.${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = sql.indexOf("create or replace function public.", start + 1);
  return sql.slice(start, next === -1 ? sql.length : next);
}

describe("Phase 5B security-remediation architecture", () => {
  it("does not let remediation code import runtime-network authority", async () => {
    const files = await collectSourceFiles(remediationDir);
    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source, path.relative(root, file)).not.toMatch(/packages\/runtime-network|lib\/runtime-network/);
    }
  });

  it("keeps runtime packages independent from hosted remediation", async () => {
    for (const directory of ["packages/runtime-observer", "packages/runtime-validator", "packages/runtime-network"]) {
      const files = await collectSourceFiles(path.resolve(root, directory));
      for (const file of files) {
        const source = await readFile(file, "utf8");
        expect(source, path.relative(root, file)).not.toMatch(/security-remediation/);
      }
    }
  });

  it("keeps Security Story v1 pure and provider/framework independent", async () => {
    const source = await readFile(storyPath, "utf8");
    expect(source).not.toMatch(/@supabase|next\/|react|runtime-network|runtime-observations|active-validation/);
  });

  it("keeps all Phase 5B mutation RPCs service-role-only with pinned search paths", async () => {
    const sql = await readFile(migrationPath, "utf8");
    for (const name of [
      "change_security_finding_work",
      "request_security_finding_retest",
      "mark_security_finding_retest_running",
      "finalize_security_finding_retest",
    ]) {
      const body = functionBody(sql, name);
      expect(body, name).toMatch(/security definer/i);
      expect(body, name).toMatch(/set search_path = ''/i);
      expect(sql, name).toMatch(new RegExp(`revoke all on function public\\.${name}[\\s\\S]*?from public, anon, authenticated`, "i"));
      expect(sql, name).toMatch(new RegExp(`grant execute on function public\\.${name}[\\s\\S]*?to service_role`, "i"));
    }

    const hardeningSql = await readFile(hardeningMigrationPath, "utf8");
    const abortBody = functionBody(hardeningSql, "abort_security_finding_retest_before_start");
    expect(abortBody).toMatch(/security definer/i);
    expect(abortBody).toMatch(/set search_path = ''/i);
    expect(hardeningSql).toMatch(/revoke all on function public\.abort_security_finding_retest_before_start[\s\S]*?from public, anon, authenticated/i);
    expect(hardeningSql).toMatch(/grant execute on function public\.abort_security_finding_retest_before_start[\s\S]*?to service_role/i);
  });

  it("enforces the exact closed runtime source registry at the database row boundary", async () => {
    const sql = await readFile(hardeningMigrationPath, "utf8");
    expect(sql).toContain("security_finding_retests_source_snapshot_check");
    expect(sql).toMatch(/execution_kind = 'passive_runtime'[\s\S]*source_id = 'scopeforge:runtime-observer'[\s\S]*source_version = '0\.1'/i);
    expect(sql).toMatch(/execution_kind = 'active_validation'[\s\S]*source_id = 'scopeforge:runtime-validator'[\s\S]*source_version = 'cors-origin-policy@1'/i);
  });

  it("stores no raw HTTP request or response authority in Phase 5B workflow tables", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const tableSection = sql.slice(0, sql.indexOf("create or replace function private.guard_security_finding_retest_update"));
    expect(tableSection).not.toMatch(/response_body|request_body|authorization|cookie|arbitrary_headers|request_headers|target_url|http_method/i);
    const hardeningSql = await readFile(hardeningMigrationPath, "utf8");
    expect(hardeningSql).not.toMatch(/response_body|request_body|authorization|cookie|arbitrary_headers|request_headers|target_url|http_method/i);
  });

  it("keeps browser retest actions free of target and execution authority", async () => {
    const source = await readFile(actionPath, "utf8");
    const retestSignature = source.match(/runFindingRetestAction\([\s\S]*?\)\s*:/)?.[0] ?? "";
    expect(retestSignature).toMatch(/findingId:\s*string/);
    expect(retestSignature).toMatch(/explicitConsent:\s*boolean/);
    expect(retestSignature).not.toMatch(/url|target|method|headers|body|source|profile|budget|scanJobId|result|lifecycle/i);
  });
});
