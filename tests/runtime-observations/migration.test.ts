import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260825_phase_4b_runtime_observations.sql",
);

describe("Phase 4B runtime observation migration", () => {
  it("drops the historical Phase 2 queued-status constraint before replacing the status enum", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const dropConstraint = sql.indexOf(
      "drop constraint if exists scan_jobs_status_check",
    );
    const alterStatusType = sql.indexOf(
      "alter column status type public.scan_job_status_phase4b",
    );

    expect(dropConstraint).toBeGreaterThanOrEqual(0);
    expect(alterStatusType).toBeGreaterThan(dropConstraint);
  });
});
