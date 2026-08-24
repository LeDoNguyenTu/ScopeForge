import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260825062000_phase_5a_hosted_finding_foundation.sql",
);

async function sql() {
  return readFile(migrationPath, "utf8");
}

describe("Phase 5A atomic runtime result persistence", () => {
  it("defines one private ingestion helper and two narrow result RPCs", async () => {
    const source = await sql();
    expect(source).toMatch(/create or replace function private\.ingest_security_finding_batch/i);
    expect(source).toMatch(/create or replace function public\.persist_passive_runtime_result/i);
    expect(source).toMatch(/create or replace function public\.persist_active_validation_result/i);
    expect(source.match(/perform private\.ingest_security_finding_batch/g)?.length ?? 0).toBe(2);
  });

  it("locks the exact runtime job and rejects cancelled or non-running persistence", async () => {
    const source = await sql();
    expect(source.match(/from public\.scan_jobs[\s\S]*?for update/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(source.match(/Runtime result persistence requires a running uncancelled job/g)?.length ?? 0)
      .toBeGreaterThanOrEqual(2);
    expect(source).toContain("job_kind_text <> 'passive_runtime'");
    expect(source).toContain("job_kind_text <> 'active_validation'");
  });

  it("keeps result RPC authority service-role only", async () => {
    const source = await sql();
    expect(source).toMatch(/revoke all on function public\.persist_passive_runtime_result[\s\S]*?from public, anon, authenticated/i);
    expect(source).toMatch(/revoke all on function public\.persist_active_validation_result[\s\S]*?from public, anon, authenticated/i);
    expect(source).toMatch(/grant execute on function public\.persist_passive_runtime_result[\s\S]*?to service_role/i);
    expect(source).toMatch(/grant execute on function public\.persist_active_validation_result[\s\S]*?to service_role/i);
    expect(source).not.toMatch(/grant execute on function public\.persist_(passive_runtime|active_validation)_result[\s\S]*?to authenticated/i);
  });

  it("makes observations, occurrences, and system events retry-idempotent", async () => {
    const source = await sql();
    expect(source).toContain("RUNTIME_OBSERVATION_ID_CONFLICT");
    expect(source).toContain("EVIDENCE_ID_CONFLICT");
    expect(source).toContain("FINDING_ID_CONFLICT");
    expect(source).toMatch(/insert into public\.security_finding_occurrences[\s\S]*?on conflict \(workspace_id, finding_id, scan_job_id\) do nothing/i);
    expect(source).toMatch(/if occurrence_id is null then[\s\S]*?continue;/i);
  });

  it("preserves human workflow while applying only approved deterministic recurrence", async () => {
    const source = await sql();
    expect(source).toMatch(/when 'resolved' then 'in_progress'/i);
    expect(source).toMatch(/when 'retest_pending' then 'in_progress'/i);
    expect(source).toMatch(/when 'verified_fixed' then 'open'/i);
    expect(source).toMatch(/when 'accepted_risk' then existing_finding\.lifecycle_state/i);
    expect(source).toMatch(/when 'false_positive' then existing_finding\.lifecycle_state/i);
    expect(source).toMatch(/observed_at >= existing_finding\.last_seen_at/i);
  });

  it("treats committed runtime observations as the cancellation linearization boundary", async () => {
    const source = await sql();
    expect(source).toContain("Runtime result persistence has already committed");
    expect(source).toMatch(/exists \([\s\S]*?from public\.runtime_observations[\s\S]*?where job_id = old\.id/i);
  });
});
