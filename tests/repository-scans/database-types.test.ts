import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const databaseTypesPath = path.resolve("lib/database.types.ts");

describe("Phase 6C live database type contract", () => {
  it("includes the repository scan enum and public provenance table", async () => {
    const source = await readFile(databaseTypesPath, "utf8");
    expect(source).toContain('"repository_scan"');
    expect(source).toContain("repository_scan_runs:");
    for (const column of [
      "snapshot_id",
      "scan_job_id",
      "scanner_profile_id",
      "scanner_profile_version",
      "resolved_commit_sha",
      "snapshot_content_digest",
      "snapshot_artifact_digest",
      "run_ref",
      "result_digest",
    ]) {
      expect(source).toContain(column);
    }
  });

  it("includes every Phase 6C public service-role RPC exposed by the live schema", async () => {
    const source = await readFile(databaseTypesPath, "utf8");
    for (const fn of [
      "register_repository_scan_worker_node",
      "enqueue_repository_scan_worker_task",
      "claim_repository_scan_worker_task",
      "get_repository_scan_snapshot_artifact",
      "finalize_repository_scan_worker_failure",
      "get_repository_scan_publication_context",
      "finalize_repository_scan_success",
    ]) {
      expect(source, `missing typed RPC ${fn}`).toContain(`${fn}:`);
    }
  });

  it("does not expose private worker or repository-scan implementation tables", async () => {
    const source = await readFile(databaseTypesPath, "utf8");
    for (const forbidden of [
      "worker_nodes:",
      "worker_tasks:",
      "worker_attempts:",
      "repository_scan_tasks:",
      "repository_snapshot_tasks:",
      "repository_source_artifacts:",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});