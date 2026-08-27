import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { RepositoryScanPublicationRepository } from "./service";
import {
  RepositoryScanError,
  repositoryScanJson,
  type RepositoryScanLeaseBoundArtifact,
  type RepositoryScanLeaseIdentity,
  type RepositoryScanPublicationContext,
  type RepositoryScanPublicationResult,
  type RepositoryScanSuccessPersistenceInput,
} from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OBJECT_KEY_PATTERN = /^repository-source\/[a-f0-9]{64}[.]tar[.]gz$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const MAX_STORED_ARTIFACT_BYTES = 335_544_320;

const KNOWN_CODES = [
  "REPOSITORY_SCAN_ARTIFACT_NOT_AVAILABLE",
  "REPOSITORY_SCAN_OUTPUT_INVALID",
  "REPOSITORY_SCAN_TERMINAL_CONFLICT",
  "REPOSITORY_SCAN_FINDING_ID_CONFLICT",
  "REPOSITORY_SCAN_EVIDENCE_ID_CONFLICT",
  "REPOSITORY_SCAN_PUBLICATION_FAILED",
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

type Phase6cPublicationContextRpc = (
  fn: "get_repository_scan_publication_context",
  args: {
    target_worker_id: string;
    target_task_id: string;
    target_attempt_id: string;
    target_lease_token: string;
  },
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

type Phase6cPublishRpc = (
  fn: "finalize_repository_scan_success",
  args: Record<string, unknown>,
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

function requiredBoundedInteger(value: unknown, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) {
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

function parsePublicationContext(value: unknown): RepositoryScanPublicationContext {
  if (!isRecord(value)) throw new RepositoryScanError("REPOSITORY_SCAN_FAILED");
  const resolvedCommitSha = requiredString(value.resolvedCommitSha);
  const contentDigest = requiredString(value.contentDigest);
  const artifactDigest = requiredString(value.artifactDigest);
  if (
    !COMMIT_PATTERN.test(resolvedCommitSha)
    || !DIGEST_PATTERN.test(contentDigest)
    || !DIGEST_PATTERN.test(artifactDigest)
    || value.scannerProfileId !== "phase3-hosted-static-v1"
    || value.scannerProfileVersion !== 1
  ) {
    throw new RepositoryScanError("REPOSITORY_SCAN_FAILED");
  }
  return Object.freeze({
    snapshotId: requiredUuid(value.snapshotId),
    canonicalRepositoryUrl: requiredString(value.canonicalRepositoryUrl),
    resolvedCommitSha,
    contentDigest,
    artifactDigest,
    retainedFileCount: requiredBoundedInteger(value.retainedFileCount, 20_000),
    retainedBytes: requiredBoundedInteger(value.retainedBytes, 268_435_456),
    scannerProfileId: "phase3-hosted-static-v1" as const,
    scannerProfileVersion: 1 as const,
  });
}

function parsePublication(value: unknown): RepositoryScanPublicationResult {
  if (!isRecord(value) || value.outcome !== "succeeded" || typeof value.replayed !== "boolean") {
    throw new RepositoryScanError("REPOSITORY_SCAN_PUBLICATION_FAILED");
  }
  return Object.freeze({
    taskId: requiredUuid(value.taskId),
    attemptId: requiredUuid(value.attemptId),
    runId: requiredUuid(value.runId),
    outcome: "succeeded" as const,
    replayed: value.replayed,
  });
}

export interface RepositoryScanArtifactRepository {
  resolveLeaseBoundArtifact(
    input: RepositoryScanLeaseIdentity,
  ): Promise<RepositoryScanLeaseBoundArtifact>;
}

export interface RepositoryScanPublicationContextRepository {
  resolvePublicationContext(
    input: RepositoryScanLeaseIdentity,
  ): Promise<RepositoryScanPublicationContext>;
}

export type RepositoryScanRepository = RepositoryScanArtifactRepository
  & RepositoryScanPublicationContextRepository
  & RepositoryScanPublicationRepository;

export function createRepositoryScanArtifactRepository(
  client: SupabaseClient<Database>,
): RepositoryScanRepository {
  const artifactRpc = client.rpc.bind(client) as unknown as Phase6cArtifactRpc;
  const contextRpc = client.rpc.bind(client) as unknown as Phase6cPublicationContextRpc;
  const publishRpc = client.rpc.bind(client) as unknown as Phase6cPublishRpc;

  return Object.freeze({
    async resolveLeaseBoundArtifact(input) {
      const { data, error } = await artifactRpc("get_repository_scan_snapshot_artifact", {
        target_worker_id: input.workerId,
        target_task_id: input.taskId,
        target_attempt_id: input.attemptId,
        target_lease_token: input.leaseToken,
      });
      if (error) throw mapRpcError(error.message);
      return parseArtifact(data);
    },

    async resolvePublicationContext(input) {
      const { data, error } = await contextRpc("get_repository_scan_publication_context", {
        target_worker_id: input.workerId,
        target_task_id: input.taskId,
        target_attempt_id: input.attemptId,
        target_lease_token: input.leaseToken,
      });
      if (error) throw mapRpcError(error.message);
      return parsePublicationContext(data);
    },

    async publishSuccess(input: RepositoryScanSuccessPersistenceInput) {
      const { data, error } = await publishRpc("finalize_repository_scan_success", {
        target_worker_id: input.workerId,
        target_task_id: input.taskId,
        target_attempt_id: input.attemptId,
        target_lease_token: input.leaseToken,
        target_snapshot_id: input.snapshotId,
        target_repository_canonical_url: input.repositoryCanonicalUrl,
        target_resolved_commit_sha: input.resolvedCommitSha,
        target_snapshot_content_digest: input.snapshotContentDigest,
        target_snapshot_artifact_digest: input.snapshotArtifactDigest,
        target_scanner_profile_id: input.scannerProfileId,
        target_scanner_profile_version: input.scannerProfileVersion,
        target_terminal_payload_digest: input.terminalPayloadDigest,
        target_result_digest: input.resultDigest,
        target_run_ref: input.runRef,
        target_tool_version: input.toolVersion,
        target_scan_started_at: input.scanStartedAt,
        target_scan_duration_ms: input.scanDurationMs,
        target_scanner_descriptors: repositoryScanJson(input.scannerDescriptors),
        target_scanner_error_count: input.scannerErrorCount,
        target_files_analyzed: input.filesAnalyzed,
        target_files_skipped: input.filesSkipped,
        target_total_bytes: input.totalBytes,
        target_wall_time_ms: input.wallTimeMs,
        target_cpu_time_ms: input.cpuTimeMs,
        target_peak_memory_bytes: input.peakMemoryBytes,
        target_input_bytes: input.inputBytes,
        target_output_bytes: input.outputBytes,
        finding_rows: repositoryScanJson(input.findings),
        evidence_rows: repositoryScanJson(input.evidence),
      });
      if (error) throw mapRpcError(error.message);
      return parsePublication(data);
    },
  });
}
