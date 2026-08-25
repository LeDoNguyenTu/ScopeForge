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
  type WorkerHeartbeatResult,
  type WorkerLeaseIdentity,
  type WorkerNodeIdentity,
  type WorkerPersistenceFinalizationInput,
  type WorkerRegistrationInput,
  type WorkerRegistrationResult,
} from "./types";

type WorkerRpcError = { message: string } | null;
type WorkerRpcResult = Promise<{ data: unknown; error: WorkerRpcError }>;
type WorkerRpc = (name: string, args?: Record<string, unknown>) => WorkerRpcResult;

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

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return value;
}

function mapRpcError(message: string): WorkerControlError {
  for (const code of KNOWN_CODES) {
    if (message.includes(code)) return new WorkerControlError(code);
  }
  return new WorkerControlError("WORKER_CONTROL_FAILED");
}

function parseNode(value: unknown): WorkerNodeIdentity {
  if (!isRecord(value) || value.executionClass !== "foundation_no_egress_v1") {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return Object.freeze({
    workerId: requiredString(value.workerId, "workerId"),
    executionClass: "foundation_no_egress_v1" as const,
    softwareVersion: requiredString(value.softwareVersion, "softwareVersion"),
  });
}

function parseRegistration(value: unknown): WorkerRegistrationResult {
  return parseNode(value);
}

function parseDisable(value: unknown): WorkerDisableResult {
  if (!isRecord(value)) throw new WorkerControlError("WORKER_CONTROL_FAILED");
  return Object.freeze({
    workerId: requiredString(value.workerId, "workerId"),
    disabledAt: requiredString(value.disabledAt, "disabledAt"),
  });
}

function parseFoundationProbe(value: unknown): FoundationProbeEnqueueResult {
  if (!isRecord(value) || value.executionClass !== "foundation_no_egress_v1") {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return Object.freeze({
    scanJobId: requiredString(value.scanJobId, "scanJobId"),
    taskId: requiredString(value.taskId, "taskId"),
    executionClass: "foundation_no_egress_v1" as const,
    absoluteDeadlineAt: requiredString(value.absoluteDeadlineAt, "absoluteDeadlineAt"),
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
    taskId: requiredString(value.taskId, "taskId"),
    attemptId: requiredString(value.attemptId, "attemptId"),
    executionClass: "foundation_no_egress_v1",
    leaseToken: requiredString(value.leaseToken, "leaseToken"),
    absoluteDeadlineAt: requiredString(value.absoluteDeadlineAt, "absoluteDeadlineAt"),
    budget: parseBudget(value.budget),
    input: {
      kind: "foundation_probe",
      nonce: requiredString(value.input.nonce, "nonce"),
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
    leaseExpiresAt: requiredString(value.leaseExpiresAt, "leaseExpiresAt"),
  });
}

function parseFinalization(value: unknown): WorkerFinalizationResult {
  if (!isRecord(value)
      || !["succeeded", "failed", "cancelled"].includes(String(value.outcome))
      || typeof value.replayed !== "boolean") {
    throw new WorkerControlError("WORKER_CONTROL_FAILED");
  }
  return Object.freeze({
    taskId: requiredString(value.taskId, "taskId"),
    attemptId: requiredString(value.attemptId, "attemptId"),
    outcome: value.outcome as WorkerFinalizationResult["outcome"],
    replayed: value.replayed,
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
}

export function createWorkerControlRepository(
  client: SupabaseClient<Database>,
): WorkerControlRepository {
  const rpc = client.rpc.bind(client) as unknown as WorkerRpc;

  async function call(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const { data, error } = await rpc(name, args);
    if (error) throw mapRpcError(error.message);
    return data;
  }

  return Object.freeze({
    async register(input) {
      return parseRegistration(await call("register_worker_node", {
        target_credential_hash: input.credentialHash,
        target_software_version: input.softwareVersion,
      }));
    },
    async disable(workerId) {
      return parseDisable(await call("disable_worker_node", { target_worker_id: workerId }));
    },
    async authenticate(input) {
      return parseNode(await call("authenticate_worker_node", {
        target_worker_id: input.workerId,
        target_credential_hash: input.credentialHash,
      }));
    },
    async enqueueFoundationProbe(input) {
      return parseFoundationProbe(await call("enqueue_foundation_worker_task", {
        target_workspace_id: input.workspaceId,
        target_asset_id: input.assetId,
        target_actor_id: input.actorId,
      }));
    },
    async claim(input) {
      return parseClaim(await call("claim_worker_task", { target_worker_id: input.workerId }));
    },
    async heartbeat(input) {
      return parseHeartbeat(await call("heartbeat_worker_attempt", {
        target_worker_id: input.workerId,
        target_task_id: input.taskId,
        target_attempt_id: input.attemptId,
        target_lease_token: input.leaseToken,
      }));
    },
    async finalize(input) {
      return parseFinalization(await call("finalize_worker_attempt", {
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
      }));
    },
    async recover(nowIso) {
      const value = await call("recover_expired_worker_attempts", { target_now: nowIso });
      if (!Number.isInteger(value) || (value as number) < 0) {
        throw new WorkerControlError("WORKER_CONTROL_FAILED");
      }
      return value as number;
    },
  });
}
