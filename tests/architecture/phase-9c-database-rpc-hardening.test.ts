import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationPath = "supabase/migrations/20260908170000_phase_9c_function_acl_hardening.sql";

const triggerOnlyFunctions = [
  "enforce_trial_asset_limit",
  "enforce_verification_quota",
  "guard_asset_verification_fields",
  "guard_runtime_observation_insert",
  "guard_runtime_scan_job_update",
  "guard_security_finding_retest_update",
  "guard_security_finding_update",
  "guard_verification_challenge_update",
  "handle_new_user",
  "handle_workspace_usage_row",
  "recover_security_finding_after_unverified_retest",
  "reject_security_evidence_mutation",
  "reject_security_finding_history_mutation",
  "reject_security_phase3_import_run_mutation",
  "set_updated_at",
  "sync_asset_usage",
  "sync_verification_usage",
] as const;

async function migration(): Promise<string> {
  return readFile(migrationPath, "utf8");
}

describe("Phase 9C database and RPC hardening", () => {
  it("revokes direct execution of every trigger-only private function", async () => {
    const sql = await migration();
    for (const fn of triggerOnlyFunctions) {
      expect(sql).toMatch(
        new RegExp(
          `revoke\\s+execute\\s+on\\s+function\\s+private\\.${fn}\\(\\)\\s+from\\s+public,\\s*anon,\\s*authenticated,\\s*service_role`,
          "i",
        ),
      );
    }
  });

  it("preserves only the authenticated RLS helper interface", async () => {
    const sql = await migration();
    expect(sql).toMatch(/grant\s+usage\s+on\s+schema\s+private\s+to\s+authenticated/i);
    expect(sql).toMatch(/grant\s+execute\s+on\s+function\s+private\.is_workspace_member\(uuid\)\s+to\s+authenticated/i);
    expect(sql).toMatch(/grant\s+execute\s+on\s+function\s+private\.has_workspace_role\(uuid,\s*public\.workspace_role\[\]\)\s+to\s+authenticated/i);
    expect(sql).toMatch(/revoke\s+all\s+on\s+schema\s+private\s+from\s+public,\s*anon,\s*service_role/i);
  });

  it("makes future postgres-owned public and private functions explicit-grant only", async () => {
    const sql = await migration();
    for (const schema of ["private", "public"]) {
      expect(sql).toMatch(
        new RegExp(
          `alter\\s+default\\s+privileges\\s+for\\s+role\\s+postgres\\s+in\\s+schema\\s+${schema}\\s+revoke\\s+execute\\s+on\\s+functions\\s+from\\s+public,\\s*anon,\\s*authenticated,\\s*service_role`,
          "i",
        ),
      );
    }
  });

  it("does not widen or mix table, policy, trigger, or worker authority changes", async () => {
    const sql = await migration();
    expect(sql).not.toMatch(/\b(create|alter|drop)\s+table\b/i);
    expect(sql).not.toMatch(/\b(create|alter|drop)\s+policy\b/i);
    expect(sql).not.toMatch(/\b(create|alter|drop)\s+trigger\b/i);
    expect(sql).not.toMatch(/\bgrant\s+(select|insert|update|delete)\b/i);
    expect(sql).not.toMatch(/\bprofiles\b|\bworkspace_members\b|\bworkspaces\b/i);
    expect(sql).not.toMatch(/HOSTED_(REPOSITORY|PASSIVE|ACTIVE)/i);
  });
});
