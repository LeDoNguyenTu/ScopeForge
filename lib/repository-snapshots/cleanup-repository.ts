import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export interface RepositorySnapshotCleanupCandidate {
  snapshotId: string | null;
  objectKey: string;
  expiresAt: string;
  reason: "expired" | "orphan";
}

export interface RepositorySnapshotCleanupRepository {
  listCandidates(input: { nowIso: string; limit: number }): Promise<readonly RepositorySnapshotCleanupCandidate[]>;
  markDeleted(input: RepositorySnapshotCleanupCandidate, nowIso: string): Promise<void>;
}

const OBJECT_KEY_PATTERN = /^repository-source\/[a-f0-9]{64}[.]tar[.]gz$/;

type RpcResult = PromiseLike<{ data: unknown; error: { message: string } | null }>;
interface CleanupRpc {
  (name: "list_repository_snapshot_cleanup_candidates", args: {
    target_now: string;
    target_limit: number;
  }): RpcResult;
  (name: "mark_repository_snapshot_artifact_deleted", args: {
    target_snapshot_id: string | null;
    target_object_key: string;
    target_reason: "expired" | "orphan";
    target_now: string;
  }): RpcResult;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCandidate(value: unknown): RepositorySnapshotCleanupCandidate {
  if (!isRecord(value)
      || (value.reason !== "expired" && value.reason !== "orphan")
      || typeof value.object_key !== "string"
      || !OBJECT_KEY_PATTERN.test(value.object_key)
      || typeof value.expires_at !== "string"
      || (value.snapshot_id !== null && typeof value.snapshot_id !== "string")) {
    throw new Error("REPOSITORY_SNAPSHOT_CLEANUP_FAILED");
  }
  if (value.reason === "expired" && value.snapshot_id === null) {
    throw new Error("REPOSITORY_SNAPSHOT_CLEANUP_FAILED");
  }
  if (value.reason === "orphan" && value.snapshot_id !== null) {
    throw new Error("REPOSITORY_SNAPSHOT_CLEANUP_FAILED");
  }
  return Object.freeze({
    snapshotId: value.snapshot_id as string | null,
    objectKey: value.object_key,
    expiresAt: value.expires_at,
    reason: value.reason,
  });
}

async function rpcData(result: RpcResult): Promise<unknown> {
  const { data, error } = await result;
  if (error) throw new Error("REPOSITORY_SNAPSHOT_CLEANUP_FAILED");
  return data;
}

export function createRepositorySnapshotCleanupRepository(
  client: SupabaseClient<Database>,
): RepositorySnapshotCleanupRepository {
  const rpc = client.rpc.bind(client) as unknown as CleanupRpc;
  return Object.freeze({
    async listCandidates(input) {
      const data = await rpcData(rpc("list_repository_snapshot_cleanup_candidates", {
        target_now: input.nowIso,
        target_limit: input.limit,
      }));
      if (!Array.isArray(data) || data.length > input.limit) {
        throw new Error("REPOSITORY_SNAPSHOT_CLEANUP_FAILED");
      }
      return Object.freeze(data.map(parseCandidate));
    },
    async markDeleted(input, nowIso) {
      await rpcData(rpc("mark_repository_snapshot_artifact_deleted", {
        target_snapshot_id: input.snapshotId,
        target_object_key: input.objectKey,
        target_reason: input.reason,
        target_now: nowIso,
      }));
    },
  });
}
