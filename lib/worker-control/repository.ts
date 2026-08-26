import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { workerExecutionProfile } from "@/packages/worker-contracts";
import type { WorkerExecutionBudget, WorkerTaskContract } from "@/packages/worker-contracts";
import {
  WorkerControlError,
  type FoundationProbeEnqueueInput,
  type FoundationProbeEnqueueResult,
  type WorkerAuthenticationInput,
  type WorkerClaimInput,
  type WorkerClaimResult,
  type WorkerDisableResult,
  type WorkerFinalizationResult,
  type WorkerFleetNodeSnapshot,
  type WorkerFleetSnapshot,
  type WorkerFleetTaskCounts,
  type WorkerHeartbeatResult,
  type WorkerLeaseIdentity,
  type WorkerNodeIdentity,
  type WorkerPersistenceFinalizationInput,
  type WorkerRegistrationInput,
  type WorkerRegistrationResult,
} from "./types";

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

function nullableString(value: unknown): string | null {
  if (value === null) return null;
  return requiredString(value);
}

function boundedCount(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return value as number;
}

function mapRpcError(message: string): WorkerControlError {
  for (const code of KNOWN_CODES) {
    if (message.includes(code)) return new WorkerControlError(code);
  }
  return new WorkerControlError("WORKER_CONTROL_FAILED");
}

async function rpcData(
  result: PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<unknown> {
  const { data, error } = await result;
  if (error) throw mapRpcError(error.message);
  return data;
}

function parseNode(value: unknown): WorkerNodeIdentity {
  if (!isRecord(value) || value.executionClass !== "foundation_no_egress_v1") {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return Object.freeze({
    workerId: requiredString(value.workerId),
    executionClass: "foundation_no_egress_v1" as const,
    softwareVersion: requiredString(value.softwareVersion),
  });
}

function parseRegistration(value: unknown): WorkerRegistrationResult {
  return parseNode(value);
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

function parseBudget(value: unknown): WorkerExecutionBudget {
  if (!isRecord(value)) throw new WorkerControlError("WORKER_CONTROL_FAILED");
  const expected = workerExecutionProfile("foundation_no_egress_v1").budget;
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (value[key] !== expectedValue) throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  if (Object.keys(value).length !== Object.keys(expected).length) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return expected;
}

function parseClaim(value: unknown): WorkerClaimResult {
  if (value === null) return null;
  if (!isRecord(value) || value.executionClass !== "foundation_no_egress_v1") {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  if (!isRecord(value.input) || value.input.kind !== "foundation_probe") {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  const contract: WorkerTaskContract = {
    taskId: requiredString(value.taskId),
    attemptId: requiredString(value.attemptId),
    executionClass: "foundation_no_egress_v1",
    leaseToken: requiredString(value.leaseToken),
    absoluteDeadlineAt: requiredString(value.absoluteDeadlineAt),
    budget: parseBudget(value.budget),
    input: {
      kind: "foundation_probe",
      nonce: requiredString(value.input.nonce),
    },
  };
  if (!/^[a-f0-9]{64}$/.test(contract.leaseToken)) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return Object.freeze(contract);
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
  if (!isRecord(value) || value.executionClass !== "foundation_no_egress_v1") {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return Object.freeze({
    workerId: requiredString(value.workerId),
    executionClass: "foundation_no_egress_v1" as const,
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
  disable(workerId: string): Promise<WorkerDisableResult>;
  authenticate(input: WorkerAuthenticationInput): Promise<WorkerNodeIdentity>;
  enqueueFoundationProbe(input: FoundationProbeEnqueueInput): Promise<FoundationProbeEnqueueResult>;
  claim(input: WorkerClaimInput): Promise<WorkerClaimResult>;
  heartbeat(input: WorkerLeaseIdentity): Promise<WorkerHeartbeatResult>;
  finalize(input: WorkerPersistenceFinalizationInput): Promise<WorkerFinalizationResult>;
  recover(nowIso: string): Promise<number>;
  fleetSnapshot(): Promise<WorkerFleetSnapshot>;
}

export function createWorkerControlRepository(
  client: SupabaseClient<Database>,
): WorkerControlRepository {
  return Object.freeze({
    async register(input) {
      return parseRegistration(await rpcData(client.rpc("register_worker_node", {
        target_credential_hash: input.credentialHash,
        target_software_version: input.softwareVersion,
      })));
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
    async claim(input) {
      return parseClaim(await rpcData(client.rpc("claim_worker_task", { target_worker_id: input.workerId })));
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
    async recover(nowIso) {
      return boundedCount(await rpcData(client.rpc("recover_expired_worker_attempts", { target_now: nowIso })));
    },
    async fleetSnapshot() {
      return parseFleetSnapshot(await rpcData(client.rpc("get_worker_fleet_snapshot")));
    },
  });
}
