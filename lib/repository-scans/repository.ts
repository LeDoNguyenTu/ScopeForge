import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  RepositoryScanError,
  type RepositoryScanLeaseBoundArtifact,
  type RepositoryScanLeaseIdentity,
} from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OBJECT_KEY_PATTERN = /^repository-source\/[a-f0-9]{64}[.]tar[.]gz$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const MAX_STORED_ARTIFACT_BYTES = 335_544_320;

const KNOWN_CODES = [
  "REPOSITORY_SCAN_ARTIFACT_NOT_AVAILABLE",
  "WORKER_LEASE_INVALID",
  "WORKER_DISABLED",
  "WORKER_JOB_STATE_CONFLICT",
] as const;

type Phase6cArtifactRpc = (
  fn: "get_repository_scan_snapshot_artifact",
  args: {
    target_worker_id: string;
    target_task_id: string;
    target_attempt_id: string;
    target_lease_token: string;
  },
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new RepositoryScanError("REPOSITORY_SCAN_FAILED");
  }
  return value;
}

function requiredUuid(value: unknown): string {
  const result = requiredString(value);
  if (!UUID_PATTERN.test(result)) throw new RepositoryScanError("REPOSITORY_SCAN_FAILED");
  return result;
}

function requiredDate(value: unknown): string {
  const result = requiredString(value);
  if (!Number.isFinite(new Date(result).getTime())) {
    throw new RepositoryScanError("REPOSITORY_SCAN_FAILED");
  }
  return result;
}

function requiredStoredBytes(value: unknown): number {
  if (
    !Number.isSafeInteger(value)
    || (value as number) < 1
    || (value as number) > MAX_STORED_ARTIFACT_BYTES
  ) {
    throw new RepositoryScanError("REPOSITORY_SCAN_FAILED");
  }
  return value as number;
}

function mapRpcError(message: string): RepositoryScanError {
  for (const code of KNOWN_CODES) {
    if (message.includes(code)) return new RepositoryScanError(code);
  }
  return new RepositoryScanError("REPOSITORY_SCAN_FAILED");
}

function parseArtifact(value: unknown): RepositoryScanLeaseBoundArtifact {
  if (!isRecord(value)) throw new RepositoryScanError("REPOSITORY_SCAN_FAILED");
  const objectKey = requiredString(value.objectKey);
  const artifactDigest = requiredString(value.artifactDigest);
  if (!OBJECT_KEY_PATTERN.test(objectKey) || !DIGEST_PATTERN.test(artifactDigest)) {
    throw new RepositoryScanError("REPOSITORY_SCAN_FAILED");
  }
  return Object.freeze({
    snapshotId: requiredUuid(value.snapshotId),
    objectKey,
    storedArtifactBytes: requiredStoredBytes(value.storedArtifactBytes),
    artifactDigest,
    leaseExpiresAt: requiredDate(value.leaseExpiresAt),
    artifactExpiresAt: requiredDate(value.artifactExpiresAt),
  });
}

export interface RepositoryScanArtifactRepository {
  resolveLeaseBoundArtifact(
    input: RepositoryScanLeaseIdentity,
  ): Promise<RepositoryScanLeaseBoundArtifact>;
}

export function createRepositoryScanArtifactRepository(
  client: SupabaseClient<Database>,
): RepositoryScanArtifactRepository {
  const rpc = client.rpc.bind(client) as unknown as Phase6cArtifactRpc;

  return Object.freeze({
    async resolveLeaseBoundArtifact(input) {
      const { data, error } = await rpc("get_repository_scan_snapshot_artifact", {
        target_worker_id: input.workerId,
        target_task_id: input.taskId,
        target_attempt_id: input.attemptId,
        target_lease_token: input.leaseToken,
      });
      if (error) throw mapRpcError(error.message);
      return parseArtifact(data);
    },
  });
}