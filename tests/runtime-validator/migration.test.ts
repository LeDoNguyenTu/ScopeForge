import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260825043000_phase_4c_active_validation.sql",
);

describe("Phase 4C active validation migration", () => {
  it("adds active validation without creating a parallel job or observation system", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("add value if not exists 'active_validation'");
    expect(sql).toContain("validation_profile_id");
    expect(sql).toContain("validation_profile_version");
    expect(sql).toContain("authorization_granted_at");
    expect(sql).toContain("'cors-policy'");
    expect(sql).not.toMatch(/create table public\.active_/i);
  });

  it("makes the active authorization snapshot immutable and bounded", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("new.validation_profile_id is distinct from old.validation_profile_id");
    expect(sql).toContain("new.validation_profile_version is distinct from old.validation_profile_version");
    expect(sql).toContain("new.authorization_granted_at is distinct from old.authorization_granted_at");
    expect(sql).toContain("validation_profile_id = 'cors-origin-policy'");
    expect(sql).toContain("validation_profile_version = 1");
    expect(sql).toContain("pg_column_size(budget) <= 2048");
  });

  it("atomically rejects observation persistence after cancellation or outside running state", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("job_status <> 'running'");
    expect(sql).toContain("job_cancel_requested_at is not null");
    expect(sql).toContain("Runtime observations require a running uncancelled job");
  });

  it("preserves authenticated select-only access for runtime observations", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("revoke all on table public.runtime_observations from anon, authenticated");
    expect(sql).toContain("grant select on table public.runtime_observations to authenticated");
    expect(sql).not.toMatch(/grant\s+(insert|update|delete)/i);
  });
});
