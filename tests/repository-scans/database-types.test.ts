import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const phase6cDatabaseTypesPath = path.resolve("lib/database.phase6c.types.ts");
const phase6dDatabaseTypesPath = path.resolve("lib/database.phase6d.types.ts");
const baseDatabaseTypesPath = path.resolve("lib/database.types.ts");
const workerControlRepositoryPath = path.resolve("lib/worker-control/repository.ts");
const workerControlServerDependenciesPath = path.resolve("lib/worker-control/server-dependencies.ts");

describe("Phase 6C live database type contract", () => {
  it("includes the repository scan enum and public provenance table", async () => {
    const source = await readFile(phase6cDatabaseTypesPath, "utf8");
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
    const source = await readFile(phase6cDatabaseTypesPath, "utf8");
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

  it("uses the Phase 6D overlay directly for trusted worker-control RPCs", async () => {
    const [phase6dSource, repositorySource, dependenciesSource] = await Promise.all([
      readFile(phase6dDatabaseTypesPath, "utf8"),
      readFile(workerControlRepositoryPath, "utf8"),
      readFile(workerControlServerDependenciesPath, "utf8"),
    ]);

    expect(phase6dSource).toContain('import type { Phase6cDatabase } from "./database.phase6c.types";');
    expect(repositorySource).toContain('import type { Phase6dDatabase } from "@/lib/database.phase6d.types";');
    expect(repositorySource).toContain("client: SupabaseClient<Phase6dDatabase>");
    expect(repositorySource).not.toContain("Phase6cWorkerRpc");
    expect(repositorySource).not.toContain("as unknown as");
    expect(dependenciesSource).toContain('import type { Phase6dDatabase } from "@/lib/database.phase6d.types";');
    expect(dependenciesSource).toContain("createAdminClient<Phase6dDatabase>()");
  });

  it("does not expose private worker or repository-scan implementation tables", async () => {
    const source = `${await readFile(baseDatabaseTypesPath, "utf8")}\n${await readFile(phase6cDatabaseTypesPath, "utf8")}`;
    const forbidden = [
      "worker_nodes",
      "worker_tasks",
      "worker_attempts",
      "repository_scan_tasks",
      "repository_snapshot_tasks",
      "repository_source_artifacts",
    ];
    for (const table of forbidden) {
      expect(source).not.toMatch(new RegExp(`^\\s{6}${table}: \\{`, "m"));
    }
  });
});
