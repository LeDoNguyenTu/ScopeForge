import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const typesPath = path.resolve(process.cwd(), "lib/database.types.ts");

describe("worker database type contract", () => {
  it("includes Phase 6A and Phase 6B job kinds and intended service-role RPC surface", async () => {
    const source = await readFile(typesPath, "utf8");

    expect(source).toContain('"worker_foundation_probe"');
    expect(source).toContain('"repository_snapshot"');
    expect(source).toContain("repository_source_snapshots: {");
    for (const fn of [
      "register_worker_node",
      "register_repository_snapshot_worker_node",
      "disable_worker_node",
      "authenticate_worker_node",
      "enqueue_foundation_worker_task",
      "enqueue_repository_snapshot_worker_task",
      "claim_worker_task",
      "heartbeat_worker_attempt",
      "finalize_worker_attempt",
      "get_repository_snapshot_attempt_artifact",
      "finalize_repository_snapshot_worker_attempt",
      "recover_expired_worker_attempts",
      "get_worker_fleet_snapshot",
      "list_repository_snapshot_cleanup_candidates",
      "mark_repository_snapshot_artifact_deleted",
    ]) {
      expect(source).toContain(`${fn}: {`);
    }
  });

  it("does not advertise private worker/artifact tables or internal recovery helpers to application code", async () => {
    const source = await readFile(typesPath, "utf8");
    for (const privateTable of [
      "worker_nodes",
      "worker_tasks",
      "worker_attempts",
      "repository_snapshot_tasks",
      "repository_snapshot_attempt_uploads",
      "repository_source_artifacts",
    ]) {
      expect(source).not.toMatch(new RegExp(`^\\s{6}${privateTable}: \\{`, "m"));
    }
    expect(source).not.toContain("recover_worker_state: {");
    expect(source).not.toContain("recover_expired_worker_attempts_leased_only: {");
  });
});