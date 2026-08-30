import type { SupabaseClient } from "@supabase/supabase-js";
import type { Phase6dDatabase } from "@/lib/database.phase6d.types";
import { workerExecutionProfile } from "@/packages/worker-contracts";
import type { WorkerExecutionBudget, WorkerExecutionClass } from "@/packages/worker-contracts";
import {
  WorkerControlError,
  type FoundationProbeEnqueueInput,
  type FoundationProbeEnqueueResult,
  type RuntimeWorkerEnqueueInput,
  type RuntimeWorkerEnqueueResult,
  type RuntimeWorkerPersistenceClaimResult,
  type WorkerAuthenticationInput,
  type WorkerClaimInput,
  type WorkerDisableResult,
  type WorkerFinalizationResult,
  type WorkerFleetNodeSnapshot,
  type WorkerFleetSnapshot,
  type WorkerFleetTaskCounts,
  type WorkerHeartbeatResult,
  type WorkerLeaseIdentity,
  type WorkerNodeIdentity,
  type WorkerPersistenceClaimResult,
  type WorkerPersistenceFinalizationInput,
  type WorkerRegistrationInput,
  type WorkerRegistrationResult,
} from "./types";

type WorkerPersistenceExecutionClass =
  | "foundation_no_egress_v1"
  | "repository_snapshot_github_public_v1"
  | "phase3_repository_scan_no_egress_v1";

type RuntimeWorkerExecutionClass =
  | "passive_runtime_observation_v1"
  | "active_cors_validation_v1";

const PERSISTENCE_EXECUTION_CLASSES = new Set<WorkerPersistenceExecutionClass>([
  "foundation_no_egress_v1",
  "repository_snapshot_github_public_v1",
  "phase3_repository_scan_no_egress_v1",
]);
const RUNTIME_EXECUTION_CLASSES = new Set<RuntimeWorkerExecutionClass>([
  "passive_runtime_observation_v1",
  "active_cors_validation_v1",
]);
const ALL_EXECUTION_CLASSES = new Set<WorkerExecutionClass>([
  ...PERSISTENCE_EXECUTION_CLASSES,
  ...RUNTIME_EXECUTION_CLASSES,
]);
const OBJECT_KEY_PATTERN = /^repository-source\/[a-f0-9]{64}[.]tar[.]gz$/;
const OWNER_REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const KNOWN_CODES = [
  "WORKER_AUTHENTICATION_FAILED",
  "WORKER_DISABLED",
  "WORKER_NOT_AVAILABLE",
  "WORKER_CREDENTIAL_INVALID",
  "WORKER_CREDENTIAL_CONFLICT",
  "WORKER_VERSION_INVALID",
  "WORKER_PROBE_ACCESS_DENIED",
  "WORKER_PROBE_ASSET_MISMATCH",
  "WORKER_LEASE_INVALID",
  "WORKER_TERMINAL_INVALID",
  "WORKER_TERMINAL_CONFLICT",
  "WORKER_BUDGET_EXCEEDED",
  "WORKER_JOB_NOT_AVAILABLE",
  "WORKER_JOB_STATE_CONFLICT",
  "REPOSITORY_SNAPSHOT_PUBLICATION_REQUIRED",
  "REPOSITORY_SCAN_PUBLICATION_REQUIRED",
  "REPOSITORY_SCAN_ARTIFACT_NOT_AVAILABLE",
  "REPOSITORY_UNAVAILABLE",
  "REPOSITORY_IDENTITY_CHANGED",
  "REPOSITORY_NETWORK_POLICY_FAILED",
  "REPOSITORY_ARCHIVE_UNSAFE",
  "REPOSITORY_ARCHIVE_BUDGET_EXCEEDED",
  "REPOSITORY_ARTIFACT_UPLOAD_FAILED",
  "RUNTIME_WORKER_ACCESS_DENIED",
  "RUNTIME_WORKER_ACTIVE_LIMIT",
  "RUNTIME_WORKER_TASK_INVALID",
  "RUNTIME_WORKER_CLASS_MISMATCH",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return value;
}

function requiredUuid(value: unknown): string {
  const result = requiredString(value);
  if (!UUID_PATTERN.test(result)) throw new WorkerControlError("WORKER_CONTROL_FAILED");
  return result;
}

function boundedInteger(value: unknown, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return value as number;
}

function nullableString(value: unknown): string | null {
  if (value === null) return null;
  return requiredString(value);
}

function boundedCount(value: unknown): number {
  return boundedInteger(value, Number.MAX_SAFE_INTEGER);
}

function parsePersistenceExecutionClass(value: unknown): WorkerPersistenceExecutionClass {
  if (typeof value !== "string" || !PERSISTENCE_EXECUTION_CLASSES.has(value as WorkerPersistenceExecutionClass)) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return value as WorkerPersistenceExecutionClass;
}

function parseRuntimeExecutionClass(value: unknown): RuntimeWorkerExecutionClass {
  if (typeof value !== "string" || !RUNTIME_EXECUTION_CLASSES.has(value as RuntimeWorkerExecutionClass)) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return value as RuntimeWorkerExecutionClass;
}

function parseWorkerExecutionClass(value: unknown): WorkerExecutionClass {
  if (typeof value !== "string" || !ALL_EXECUTION_CLASSES.has(value as WorkerExecutionClass)) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return value as WorkerExecutionClass;
}

function mapRpcError(message: string): WorkerControlError {
  for (const code of KNOWN_CODES) {
    if (message.includes(code)) return new WorkerControlError(code);
  }
  return new WorkerControlError("WORKER_CONTROL_FAILED");
}

async function rpcData<T>(
  result: PromiseLike<{ data: T; error: { message: string } | null }>,
): Promise<T> {
  const { data, error } = await result;
  if (error) throw mapRpcError(error.message);
  return data;
}

function parseNode(value: unknown): WorkerNodeIdentity {
  if (!isRecord(value)) throw new WorkerControlError("WORKER_CONTROL_FAILED");
  return Object.freeze({
    workerId: requiredString(value.workerId),
    executionClass: parseWorkerExecutionClass(value.executionClass),
    softwareVersion: requiredString(value.softwareVersion),
  });
}

function parseRegistration(value: unknown): WorkerRegistrationResult {
  return parseNode(value);
}

function parseRuntimeRegistration(
  value: unknown,
  expectedClass: RuntimeWorkerExecutionClass,
): WorkerRegistrationResult {
  const node = parseNode(value);
  if (node.executionClass !== expectedClass) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return node;
}

function parseDisable(value: unknown): WorkerDisableResult {
  if (!isRecord(value)) throw new WorkerControlError("WORKER_CONTROL_FAILED");
  return Object.freeze({
    workerId: requiredString(value.workerId),
    disabledAt: requiredString(value.disabledAt),
  });
}

function parseFoundationProbe(value: unknown): FoundationProbeEnqueueResult {
  if (!isRecord(value) || value.executionClass !== "foundation_no_egress_v1") {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return Object.freeze({
    scanJobId: requiredString(value.scanJobId),
    taskId: requiredString(value.taskId),
    executionClass: "foundation_no_egress_v1" as const,
    absoluteDeadlineAt: requiredString(value.absoluteDeadlineAt),
  });
}

function parseRuntimeEnqueue(
  value: unknown,
  expectedClass: RuntimeWorkerExecutionClass,
): RuntimeWorkerEnqueueResult {
  if (!isRecord(value) || value.executionClass !== expectedClass) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return Object.freeze({
    scanJobId: requiredUuid(value.scanJobId),
    taskId: requiredUuid(value.taskId),
    executionClass: expectedClass,
    absoluteDeadlineAt: requiredString(value.absoluteDeadlineAt),
  }) as RuntimeWorkerEnqueueResult;
}

function parseBudget(value: unknown, executionClass: WorkerExecutionClass): WorkerExecutionBudget {
  if (!isRecord(value)) throw new WorkerControlError("WORKER_CONTROL_FAILED");
  const expected = workerExecutionProfile(executionClass).budget;
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (value[key] !== expectedValue) throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  if (Object.keys(value).length !== Object.keys(expected).length) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return expected;
}

function parseCanonicalRepositoryIdentity(input: Record<string, unknown>): {
  owner: string;
  repository: string;
  canonicalRepositoryUrl: string;
} {
  const owner = requiredString(input.owner);
  const repository = requiredString(input.repository);
  const canonicalRepositoryUrl = requiredString(input.canonicalRepositoryUrl);
  if (!OWNER_REPOSITORY_PATTERN.test(owner) || !OWNER_REPOSITORY_PATTERN.test(repository)) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  if (canonicalRepositoryUrl !== `https://github.com/${owner}/${repository}`) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return { owner, repository, canonicalRepositoryUrl };
}

function parseRepositoryScanInput(input: Record<string, unknown>) {
  if (input.kind !== "phase3_repository_scan") {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  const canonicalRepositoryUrl = requiredString(input.canonicalRepositoryUrl);
  let canonicalUrl: URL;
  try {
    canonicalUrl = new URL(canonicalRepositoryUrl);
  } catch {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  if (canonicalUrl.protocol !== "https:"
      || canonicalUrl.hostname !== "github.com"
      || canonicalUrl.username !== ""
      || canonicalUrl.password !== ""
      || canonicalUrl.search !== ""
      || canonicalUrl.hash !== ""
      || canonicalUrl.pathname.split("/").filter(Boolean).length !== 2) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  const resolvedCommitSha = requiredString(input.resolvedCommitSha);
  const contentDigest = requiredString(input.contentDigest);
  const artifactDigest = requiredString(input.artifactDigest);
  if (!COMMIT_PATTERN.test(resolvedCommitSha)
      || !DIGEST_PATTERN.test(contentDigest)
      || !DIGEST_PATTERN.test(artifactDigest)
      || input.scannerProfileId !== "phase3-hosted-static-v1"
      || input.scannerProfileVersion !== 1) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return Object.freeze({
    kind: "phase3_repository_scan" as const,
    snapshotId: requiredUuid(input.snapshotId),
    canonicalRepositoryUrl,
    resolvedCommitSha,
    contentDigest,
    artifactDigest,
    storedArtifactBytes: boundedInteger(input.storedArtifactBytes, 335_544_320),
    retainedFileCount: boundedInteger(input.retainedFileCount, 20_000),
    retainedBytes: boundedInteger(input.retainedBytes, 268_435_456),
    scannerProfileId: "phase3-hosted-static-v1" as const,
    scannerProfileVersion: 1 as const,
  });
}

function parseClaim(value: unknown): WorkerPersistenceClaimResult {
  if (value === null) return null;
  if (!isRecord(value)) throw new WorkerControlError("WORKER_CONTROL_FAILED");
  const executionClass = parsePersistenceExecutionClass(value.executionClass);
  if (!isRecord(value.input)) throw new WorkerControlError("WORKER_CONTROL_FAILED");
  const common = {
    taskId: requiredString(value.taskId),
    attemptId: requiredString(value.attemptId),
    leaseToken: requiredString(value.leaseToken),
    absoluteDeadlineAt: requiredString(value.absoluteDeadlineAt),
    budget: parseBudget(value.budget, executionClass),
  };
  if (!/^[a-f0-9]{64}$/.test(common.leaseToken)) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }

  if (executionClass === "foundation_no_egress_v1") {
    if (value.input.kind !== "foundation_probe") {
      throw new WorkerControlError("WORKER_CONTROL_FAILED");
    }
    return Object.freeze({
      ...common,
      executionClass,
      input: Object.freeze({
        kind: "foundation_probe" as const,
        nonce: requiredString(value.input.nonce),
      }),
    });
  }

  if (executionClass === "phase3_repository_scan_no_egress_v1") {
    return Object.freeze({
      ...common,
      executionClass,
      input: parseRepositoryScanInput(value.input),
    });
  }

  if (value.input.kind !== "repository_snapshot_github_public") {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  const artifactObjectKey = requiredString(value.artifactObjectKey);
  if (!OBJECT_KEY_PATTERN.test(artifactObjectKey)) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  const identity = parseCanonicalRepositoryIdentity(value.input);
  return Object.freeze({
    ...common,
    executionClass,
    artifactObjectKey,
    input: Object.freeze({
      kind: "repository_snapshot_github_public" as const,
      ...identity,
    }),
  });
}

function parseRuntimeClaim(value: unknown): RuntimeWorkerPersistenceClaimResult {
  if (value === null) return null;
  if (!isRecord(value) || !isRecord(value.input)) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  const executionClass = parseRuntimeExecutionClass(value.executionClass);
  const inputKeys = Object.keys(value.input).sort();
  if (inputKeys.length !== 2 || inputKeys[0] !== "domainJobId" || inputKeys[1] !== "kind") {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  const domainJobId = requiredUuid(value.input.domainJobId);
  const leaseToken = requiredString(value.leaseToken);
  if (!/^[a-f0-9]{64}$/.test(leaseToken)) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  const common = {
    taskId: requiredUuid(value.taskId),
    attemptId: requiredUuid(value.attemptId),
    leaseToken,
    absoluteDeadlineAt: requiredString(value.absoluteDeadlineAt),
    budget: parseBudget(value.budget, executionClass),
  };

  if (executionClass === "passive_runtime_observation_v1") {
    if (value.input.kind !== "passive_runtime_observation") {
      throw new WorkerControlError("WORKER_CONTROL_FAILED");
    }
    return Object.freeze({
      ...common,
      executionClass,
      input: Object.freeze({ kind: "passive_runtime_observation" as const, domainJobId }),
    });
  }

  if (value.input.kind !== "active_cors_validation") {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return Object.freeze({
    ...common,
    executionClass,
    input: Object.freeze({ kind: "active_cors_validation" as const, domainJobId }),
  });
}

function parseHeartbeat(value: unknown): WorkerHeartbeatResult {
  if (!isRecord(value) || typeof value.cancelRequested !== "boolean") {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return Object.freeze({
    cancelRequested: value.cancelRequested,
    leaseExpiresAt: requiredString(value.leaseExpiresAt),
  });
}

function parseFinalization(value: unknown): WorkerFinalizationResult {
  if (!isRecord(value)
      || !["succeeded", "failed", "cancelled"].includes(String(value.outcome))
      || typeof value.replayed !== "boolean") {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return Object.freeze({
    taskId: requiredString(value.taskId),
    attemptId: requiredString(value.attemptId),
    outcome: value.outcome as WorkerFinalizationResult["outcome"],
    replayed: value.replayed,
  });
}

function parseFleetNode(value: unknown): WorkerFleetNodeSnapshot {
  if (!isRecord(value)) throw new WorkerControlError("WORKER_CONTROL_FAILED");
  return Object.freeze({
    workerId: requiredString(value.workerId),
    executionClass: parseWorkerExecutionClass(value.executionClass),
    softwareVersion: requiredString(value.softwareVersion),
    registeredAt: requiredString(value.registeredAt),
    lastSeenAt: nullableString(value.lastSeenAt),
    disabledAt: nullableString(value.disabledAt),
  });
}

function parseFleetTaskCounts(value: unknown): WorkerFleetTaskCounts {
  if (!isRecord(value)) throw new WorkerControlError("WORKER_CONTROL_FAILED");
  return Object.freeze({
    queued: boundedCount(value.queued),
    leased: boundedCount(value.leased),
    retryWait: boundedCount(value.retryWait),
    completed: boundedCount(value.completed),
    deadLetter: boundedCount(value.deadLetter),
    cancelled: boundedCount(value.cancelled),
  });
}

function parseFleetSnapshot(value: unknown): WorkerFleetSnapshot {
  if (!isRecord(value) || !Array.isArray(value.nodes) || value.nodes.length > 100) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return Object.freeze({
    generatedAt: requiredString(value.generatedAt),
    nodes: Object.freeze(value.nodes.map(parseFleetNode)),
    taskCounts: parseFleetTaskCounts(value.taskCounts),
    activeLeaseCount: boundedCount(value.activeLeaseCount),
  });
}

export interface WorkerControlRepository {
  register(input: WorkerRegistrationInput): Promise<WorkerRegistrationResult>;
  registerRepositorySnapshot(input: WorkerRegistrationInput): Promise<WorkerRegistrationResult>;
  registerRepositoryScan(input: WorkerRegistrationInput): Promise<WorkerRegistrationResult>;
  registerPassiveRuntime(input: WorkerRegistrationInput): Promise<WorkerRegistrationResult>;
  registerActiveCors(input: WorkerRegistrationInput): Promise<WorkerRegistrationResult>;
  disable(workerId: string): Promise<WorkerDisableResult>;
  authenticate(input: WorkerAuthenticationInput): Promise<WorkerNodeIdentity>;
  enqueueFoundationProbe(input: FoundationProbeEnqueueInput): Promise<FoundationProbeEnqueueResult>;
  enqueuePassiveRuntime(input: RuntimeWorkerEnqueueInput): Promise<RuntimeWorkerEnqueueResult>;
  enqueueActiveCors(input: RuntimeWorkerEnqueueInput): Promise<RuntimeWorkerEnqueueResult>;
  claim(input: WorkerClaimInput): Promise<WorkerPersistenceClaimResult>;
  claimRepositoryScan(input: WorkerClaimInput): Promise<WorkerPersistenceClaimResult>;
  claimRuntime(input: WorkerClaimInput): Promise<RuntimeWorkerPersistenceClaimResult>;
  heartbeat(input: WorkerLeaseIdentity): Promise<WorkerHeartbeatResult>;
  finalize(input: WorkerPersistenceFinalizationInput): Promise<WorkerFinalizationResult>;
  finalizeRepositoryScanFailure(input: WorkerPersistenceFinalizationInput): Promise<WorkerFinalizationResult>;
  recover(nowIso: string): Promise<number>;
  fleetSnapshot(): Promise<WorkerFleetSnapshot>;
}

export function createWorkerControlRepository(
  client: SupabaseClient<Phase6dDatabase>,
): WorkerControlRepository {
  return Object.freeze<WorkerControlRepository>({
    async register(input) {
      return parseRegistration(await rpcData(client.rpc("register_worker_node", {
        target_credential_hash: input.credentialHash,
        target_software_version: input.softwareVersion,
      })));
    },
    async registerRepositorySnapshot(input) {
      return parseRegistration(await rpcData(client.rpc("register_repository_snapshot_worker_node", {
        target_credential_hash: input.credentialHash,
        target_software_version: input.softwareVersion,
      })));
    },
    async registerRepositoryScan(input) {
      return parseRegistration(await rpcData(client.rpc("register_repository_scan_worker_node", {
        target_credential_hash: input.credentialHash,
        target_software_version: input.softwareVersion,
      })));
    },
    async registerPassiveRuntime(input) {
      return parseRuntimeRegistration(await rpcData(client.rpc("register_passive_runtime_worker_node", {
        target_credential_hash: input.credentialHash,
        target_software_version: input.softwareVersion,
      })), "passive_runtime_observation_v1");
    },
    async registerActiveCors(input) {
      return parseRuntimeRegistration(await rpcData(client.rpc("register_active_cors_worker_node", {
        target_credential_hash: input.credentialHash,
        target_software_version: input.softwareVersion,
      })), "active_cors_validation_v1");
    },
    async disable(workerId) {
      return parseDisable(await rpcData(client.rpc("disable_worker_node", { target_worker_id: workerId })));
    },
    async authenticate(input) {
      return parseNode(await rpcData(client.rpc("authenticate_worker_node", {
        target_worker_id: input.workerId,
        target_credential_hash: input.credentialHash,
      })));
    },
    async enqueueFoundationProbe(input) {
      return parseFoundationProbe(await rpcData(client.rpc("enqueue_foundation_worker_task", {
        target_workspace_id: input.workspaceId,
        target_asset_id: input.assetId,
        target_actor_id: input.actorId,
      })));
    },
    async enqueuePassiveRuntime(input) {
      return parseRuntimeEnqueue(await rpcData(client.rpc("enqueue_passive_runtime_worker_task", {
        target_workspace_id: input.workspaceId,
        target_scan_job_id: input.scanJobId,
        target_actor_id: input.actorId,
      })), "passive_runtime_observation_v1");
    },
    async enqueueActiveCors(input) {
      return parseRuntimeEnqueue(await rpcData(client.rpc("enqueue_active_cors_worker_task", {
        target_workspace_id: input.workspaceId,
        target_scan_job_id: input.scanJobId,
        target_actor_id: input.actorId,
      })), "active_cors_validation_v1");
    },
    async claim(input) {
      return parseClaim(await rpcData(client.rpc("claim_worker_task", { target_worker_id: input.workerId })));
    },
    async claimRepositoryScan(input) {
      const claim = parseClaim(await rpcData(client.rpc("claim_repository_scan_worker_task", {
        target_worker_id: input.workerId,
      })));
      if (claim !== null && claim.executionClass !== "phase3_repository_scan_no_egress_v1") {
        throw new WorkerControlError("WORKER_CONTROL_FAILED");
      }
      return claim;
    },
    async claimRuntime(input) {
      return parseRuntimeClaim(await rpcData(client.rpc("claim_runtime_worker_task", {
        target_worker_id: input.workerId,
      })));
    },
    async heartbeat(input) {
      return parseHeartbeat(await rpcData(client.rpc("heartbeat_worker_attempt", {
        target_worker_id: input.workerId,
        target_task_id: input.taskId,
        target_attempt_id: input.attemptId,
        target_lease_token: input.leaseToken,
      })));
    },
    async finalize(input) {
      return parseFinalization(await rpcData(client.rpc("finalize_worker_attempt", {
        target_worker_id: input.workerId,
        target_task_id: input.taskId,
        target_attempt_id: input.attemptId,
        target_lease_token: input.leaseToken,
        target_terminal_outcome: input.terminalOutcome,
        target_failure_code: input.failureCode,
        target_terminal_payload_digest: input.terminalPayloadDigest,
        target_wall_time_ms: input.wallTimeMs,
        target_cpu_time_ms: input.cpuTimeMs,
        target_peak_memory_bytes: input.peakMemoryBytes,
        target_input_bytes: input.inputBytes,
        target_output_bytes: input.outputBytes,
      })));
    },
    async finalizeRepositoryScanFailure(input) {
      return parseFinalization(await rpcData(client.rpc("finalize_repository_scan_worker_failure", {
        target_worker_id: input.workerId,
        target_task_id: input.taskId,
        target_attempt_id: input.attemptId,
        target_lease_token: input.leaseToken,
        target_terminal_outcome: input.terminalOutcome,
        target_failure_code: input.failureCode,
        target_terminal_payload_digest: input.terminalPayloadDigest,
        target_wall_time_ms: input.wallTimeMs,
        target_cpu_time_ms: input.cpuTimeMs,
        target_peak_memory_bytes: input.peakMemoryBytes,
        target_input_bytes: input.inputBytes,
        target_output_bytes: input.outputBytes,
      })));
    },
    async recover(nowIso) {
      return boundedCount(await rpcData(client.rpc("recover_expired_worker_attempts", { target_now: nowIso })));
    },
    async fleetSnapshot() {
      return parseFleetSnapshot(await rpcData(client.rpc("get_worker_fleet_snapshot")));
    },
  });
}
