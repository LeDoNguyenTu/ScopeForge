import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import {
  RepositorySnapshotError,
  type RepositorySnapshotAttemptArtifact,
  type RepositorySnapshotLeaseIdentity,
  type RepositorySnapshotPublicationInput,
  type RepositorySnapshotPublicationResult,
  type RequestRepositorySnapshotInput,
  type RequestRepositorySnapshotResult,
} from "./types";

const OBJECT_KEY_PATTERN = /^repository-source\/[a-f0-9]{64}[.]tar[.]gz$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const KNOWN_CODES = [
  "REPOSITORY_SNAPSHOT_REQUEST_INVALID",
  "REPOSITORY_SNAPSHOT_ACCESS_DENIED",
  "REPOSITORY_SNAPSHOT_ASSET_MISMATCH",
  "REPOSITORY_SNAPSHOT_COOLDOWN",
  "REPOSITORY_SNAPSHOT_DAILY_LIMIT",
  "REPOSITORY_SNAPSHOT_ACTIVE_LIMIT",
  "REPOSITORY_SNAPSHOT_TASK_INVALID",
  "REPOSITORY_SNAPSHOT_ARTIFACT_NOT_AVAILABLE",
  "REPOSITORY_SNAPSHOT_TERMINAL_INVALID",
  "REPOSITORY_SNAPSHOT_TERMINAL_CONFLICT",
  "REPOSITORY_SNAPSHOT_PUBLICATION_REQUIRED",
  "WORKER_LEASE_INVALID",
  "WORKER_DISABLED",
  "WORKER_JOB_STATE_CONFLICT",
] as const;

type RpcResult = PromiseLike<{ data: unknown; error: { message: string } | null }>;
interface RepositorySnapshotRpc {
  (name: "enqueue_repository_snapshot_worker_task", args: {
    target_workspace_id: string;
    target_asset_id: string;
    target_actor_id: string;
  }): RpcResult;
  (name: "get_repository_snapshot_attempt_artifact", args: {
    target_worker_id: string;
    target_task_id: string;
    target_attempt_id: string;
    target_lease_token: string;
  }): RpcResult;
  (name: "finalize_repository_snapshot_worker_attempt", args: {
    target_worker_id: string;
    target_task_id: string;
    target_attempt_id: string;
    target_lease_token: string;
    target_terminal_payload_digest: string;
    target_canonical_repository_url: string;
    target_default_branch: string;
    target_resolved_commit_sha: string;
    target_content_digest: string;
    target_artifact_digest: string;
    target_compressed_bytes: number;
    target_expanded_bytes: number;
    target_retained_file_count: number;
    target_retained_bytes: number;
    target_stored_artifact_bytes: number;
    target_skip_counts: Json;
    target_wall_time_ms: number;
    target_cpu_time_ms: number;
    target_peak_memory_bytes: number;
    target_input_bytes: number;
    target_output_bytes: number;
    target_server_observed_object_bytes: number;
  }): RpcResult;
}

function rpcFor(client: SupabaseClient<Database>): RepositorySnapshotRpc {
  return client.rpc.bind(client) as unknown as RepositorySnapshotRpc;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_FAILED");
  }
  return value;
}

function requiredUuid(value: unknown): string {
  const result = requiredString(value);
  if (!UUID_PATTERN.test(result)) throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_FAILED");
  return result;
}

function mapRpcError(message: string): RepositorySnapshotError {
  for (const code of KNOWN_CODES) {
    if (message.includes(code)) return new RepositorySnapshotError(code);
  }
  return new RepositorySnapshotError("REPOSITORY_SNAPSHOT_FAILED");
}

async function rpcData(result: RpcResult): Promise<unknown> {
  const { data, error } = await result;
  if (error) throw mapRpcError(error.message);
  return data;
}

function parseEnqueue(value: unknown): RequestRepositorySnapshotResult {
  if (!isRecord(value) || value.executionClass !== "repository_snapshot_github_public_v1") {
    throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_FAILED");
  }
  return Object.freeze({
    scanJobId: requiredUuid(value.scanJobId),
    taskId: requiredUuid(value.taskId),
    executionClass: "repository_snapshot_github_public_v1" as const,
    absoluteDeadlineAt: requiredString(value.absoluteDeadlineAt),
  });
}

function parseAttemptArtifact(value: unknown): RepositorySnapshotAttemptArtifact {
  if (!isRecord(value)) throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_FAILED");
  const objectKey = requiredString(value.objectKey);
  if (!OBJECT_KEY_PATTERN.test(objectKey)) {
    throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_FAILED");
  }
  return Object.freeze({
    objectKey,
    createdAt: requiredString(value.createdAt),
  });
}

function parsePublication(value: unknown): RepositorySnapshotPublicationResult {
  if (!isRecord(value)
      || !["succeeded", "cancelled"].includes(String(value.outcome))
      || typeof value.replayed !== "boolean") {
    throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_FAILED");
  }
  const snapshotId = value.snapshotId === undefined || value.snapshotId === null
    ? undefined
    : requiredUuid(value.snapshotId);
  if (value.outcome === "succeeded" && snapshotId === undefined) {
    throw new RepositorySnapshotError("REPOSITORY_SNAPSHOT_FAILED");
  }
  return Object.freeze({
    taskId: requiredUuid(value.taskId),
    attemptId: requiredUuid(value.attemptId),
    ...(snapshotId === undefined ? {} : { snapshotId }),
    outcome: value.outcome as "succeeded" | "cancelled",
    replayed: value.replayed,
  });
}

export interface RepositorySnapshotRepository {
  enqueue(input: RequestRepositorySnapshotInput): Promise<RequestRepositorySnapshotResult>;
  getAttemptArtifact(input: RepositorySnapshotLeaseIdentity): Promise<RepositorySnapshotAttemptArtifact>;
  publish(input: RepositorySnapshotPublicationInput): Promise<RepositorySnapshotPublicationResult>;
}

export function createRepositorySnapshotRepository(
  client: SupabaseClient<Database>,
): RepositorySnapshotRepository {
  const rpc = rpcFor(client);
  return Object.freeze({
    async enqueue(input) {
      return parseEnqueue(await rpcData(rpc("enqueue_repository_snapshot_worker_task", {
        target_workspace_id: input.workspaceId,
        target_asset_id: input.assetId,
        target_actor_id: input.actorId,
      })));
    },

    async getAttemptArtifact(input) {
      return parseAttemptArtifact(await rpcData(rpc("get_repository_snapshot_attempt_artifact", {
        target_worker_id: input.workerId,
        target_task_id: input.taskId,
        target_attempt_id: input.attemptId,
        target_lease_token: input.leaseToken,
      })));
    },

    async publish(input) {
      return parsePublication(await rpcData(rpc("finalize_repository_snapshot_worker_attempt", {
        target_worker_id: input.workerId,
        target_task_id: input.taskId,
        target_attempt_id: input.attemptId,
        target_lease_token: input.leaseToken,
        target_terminal_payload_digest: input.terminalPayloadDigest,
        target_canonical_repository_url: input.canonicalRepositoryUrl,
        target_default_branch: input.defaultBranch,
        target_resolved_commit_sha: input.resolvedCommitSha,
        target_content_digest: input.contentDigest,
        target_artifact_digest: input.artifactDigest,
        target_compressed_bytes: input.compressedBytes,
        target_expanded_bytes: input.expandedBytes,
        target_retained_file_count: input.retainedFileCount,
        target_retained_bytes: input.retainedBytes,
        target_stored_artifact_bytes: input.storedArtifactBytes,
        target_skip_counts: input.skipCounts,
        target_wall_time_ms: input.wallTimeMs,
        target_cpu_time_ms: input.cpuTimeMs,
        target_peak_memory_bytes: input.peakMemoryBytes,
        target_input_bytes: input.inputBytes,
        target_output_bytes: input.outputBytes,
        target_server_observed_object_bytes: input.serverObservedObjectBytes,
      })));
    },
  });
}
