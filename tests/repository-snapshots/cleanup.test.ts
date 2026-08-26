import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  cleanupRepositorySnapshotArtifacts,
  type RepositorySnapshotCleanupRepository,
} from "@/lib/repository-snapshots/cleanup";
import type { RepositorySnapshotObjectStore } from "@/lib/repository-snapshots/object-store";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260827010400_phase_6b_repository_snapshot_cleanup.sql",
);

function repository(candidates: Awaited<ReturnType<RepositorySnapshotCleanupRepository["listCandidates"]>>): RepositorySnapshotCleanupRepository {
  return {
    listCandidates: vi.fn(async () => candidates),
    markDeleted: vi.fn(async () => undefined),
  };
}

function objectStore(deleteObject = vi.fn(async () => undefined)): RepositorySnapshotObjectStore {
  return {
    createAttemptUpload: vi.fn(),
    headObject: vi.fn(),
    deleteObject,
  };
}

describe("Phase 6B repository snapshot artifact cleanup", () => {
  it("deletes bounded expired and orphan candidates then marks database state", async () => {
    const candidates = [
      {
        snapshotId: "11111111-1111-4111-8111-111111111111",
        objectKey: `repository-source/${"a".repeat(64)}.tar.gz`,
        expiresAt: "2026-08-27T00:00:00.000Z",
        reason: "expired" as const,
      },
      {
        snapshotId: null,
        objectKey: `repository-source/${"b".repeat(64)}.tar.gz`,
        expiresAt: "2026-08-27T00:00:00.000Z",
        reason: "orphan" as const,
      },
    ];
    const repo = repository(candidates);
    const store = objectStore();
    const result = await cleanupRepositorySnapshotArtifacts({
      now: new Date("2026-08-28T00:00:00.000Z"),
      limit: 1000,
    }, { repository: repo, objectStore: store });

    expect(result).toEqual({ deleted: 2, failed: 0 });
    expect(repo.listCandidates).toHaveBeenCalledWith({
      nowIso: "2026-08-28T00:00:00.000Z",
      limit: 100,
    });
    expect(store.deleteObject).toHaveBeenCalledTimes(2);
    expect(repo.markDeleted).toHaveBeenCalledTimes(2);
  });

  it("keeps failed deletion retryable and continues with later candidates", async () => {
    const candidates = [
      {
        snapshotId: null,
        objectKey: `repository-source/${"a".repeat(64)}.tar.gz`,
        expiresAt: "2026-08-27T00:00:00.000Z",
        reason: "orphan" as const,
      },
      {
        snapshotId: null,
        objectKey: `repository-source/${"b".repeat(64)}.tar.gz`,
        expiresAt: "2026-08-27T00:00:00.000Z",
        reason: "orphan" as const,
      },
    ];
    const repo = repository(candidates);
    const deleteObject = vi.fn(async (objectKey: string) => {
      if (objectKey.includes("a".repeat(64))) throw new Error("temporary R2 failure");
    });
    const result = await cleanupRepositorySnapshotArtifacts({
      now: new Date("2026-08-28T00:00:00.000Z"),
      limit: 20,
    }, { repository: repo, objectStore: objectStore(deleteObject) });

    expect(result).toEqual({ deleted: 1, failed: 1 });
    expect(repo.markDeleted).toHaveBeenCalledTimes(1);
    expect(vi.mocked(repo.markDeleted).mock.calls[0]?.[0].objectKey).toContain("b".repeat(64));
  });

  it("keeps cleanup service-role-only and public provenance immutable", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("create or replace function public.list_repository_snapshot_cleanup_candidates");
    expect(sql).toContain("create or replace function public.mark_repository_snapshot_artifact_deleted");
    expect(sql).toContain("interval '24 hours'");
    expect(sql).toContain("target_limit between 1 and 100");
    expect(sql).toContain("grant execute on function public.list_repository_snapshot_cleanup_candidates");
    expect(sql).toContain("grant execute on function public.mark_repository_snapshot_artifact_deleted");
    expect(sql).not.toMatch(/update\s+public[.]repository_source_snapshots/is);
    expect(sql).not.toMatch(/delete\s+from\s+public[.]repository_source_snapshots/is);
  });
});
