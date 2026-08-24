import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = path.resolve(process.cwd(), "supabase/migrations");
const runtimeMigrationPath = path.join(
  migrationsDirectory,
  "20260824173159_phase_4b_runtime_observations.sql",
);

async function allMigrationSql(): Promise<string> {
  const filenames = (await readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();
  const contents = await Promise.all(
    filenames.map((filename) => readFile(path.join(migrationsDirectory, filename), "utf8")),
  );
  return contents.join("\n");
}

describe("Phase 4B runtime observation migration", () => {
  it("uses the migration version recorded by the connected project", async () => {
    await expect(readFile(runtimeMigrationPath, "utf8")).resolves.toContain(
      "create type public.scan_job_kind",
    );
  });

  it("drops the historical Phase 2 queued-status constraint before replacing the status enum", async () => {
    const sql = await readFile(runtimeMigrationPath, "utf8");
    const dropConstraint = sql.indexOf(
      "drop constraint if exists scan_jobs_status_check",
    );
    const alterStatusType = sql.indexOf(
      "alter column status type public.scan_job_status_phase4b",
    );

    expect(dropConstraint).toBeGreaterThanOrEqual(0);
    expect(alterStatusType).toBeGreaterThan(dropConstraint);
  });

  it("covers both runtime observation composite foreign keys with leading-column indexes", async () => {
    const sql = await allMigrationSql();

    expect(sql).toContain(
      "on public.runtime_observations(asset_id, workspace_id)",
    );
    expect(sql).toContain(
      "on public.runtime_observations(job_id, workspace_id, asset_id)",
    );
  });
});
