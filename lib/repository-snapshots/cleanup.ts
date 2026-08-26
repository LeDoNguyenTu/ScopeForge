import type { RepositorySnapshotObjectStore } from "./object-store";
import type {
  RepositorySnapshotCleanupRepository,
} from "./cleanup-repository";

export type {
  RepositorySnapshotCleanupCandidate,
  RepositorySnapshotCleanupRepository,
} from "./cleanup-repository";

export async function cleanupRepositorySnapshotArtifacts(
  input: { now: Date; limit: number },
  dependencies: {
    repository: RepositorySnapshotCleanupRepository;
    objectStore: RepositorySnapshotObjectStore;
  },
): Promise<{ deleted: number; failed: number }> {
  if (!Number.isFinite(input.now.getTime())) {
    throw new Error("REPOSITORY_SNAPSHOT_CLEANUP_INVALID");
  }
  if (!Number.isInteger(input.limit) || input.limit < 1) {
    throw new Error("REPOSITORY_SNAPSHOT_CLEANUP_INVALID");
  }

  const nowIso = input.now.toISOString();
  const limit = Math.min(100, input.limit);
  const candidates = await dependencies.repository.listCandidates({ nowIso, limit });
  let deleted = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      await dependencies.objectStore.deleteObject(candidate.objectKey);
      await dependencies.repository.markDeleted(candidate, nowIso);
      deleted += 1;
    } catch {
      failed += 1;
    }
  }

  return Object.freeze({ deleted, failed });
}
