import type { SupabaseClient } from "@supabase/supabase-js";
import type { Phase6dDatabase } from "@/lib/database.phase6d.types";
import { WorkerControlError } from "@/lib/worker-control/types";
import type {
  RuntimeWorkerFinalizationContext,
  RuntimeWorkerFinalizeInput,
  RuntimeWorkerPublicationIdentity,
} from "./publication";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const CONTEXT_KEYS = Object.freeze([
  "assetId",
  "attemptId",
  "cancelRequested",
  "domainJobId",
  "executionClass",
  "finishedAt",
  "leaseExpiresAt",
  "priorOutcome",
  "priorTerminalDigest",
  "taskId",
  "workspaceId",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new WorkerControlError("RUNTIME_WORKER_TASK_INVALID");
  }
  return value;
}

function nullableIso(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new WorkerControlError("RUNTIME_WORKER_TASK_INVALID");
  }
  return value;
}

function parseContext(value: unknown): RuntimeWorkerFinalizationContext {
  if (!isRecord(value)) throw new WorkerControlError("RUNTIME_WORKER_TASK_INVALID");
  const keys = Object.keys(value).sort();
  if (keys.length !== CONTEXT_KEYS.length || keys.some((key, index) => key !== CONTEXT_KEYS[index])) {
    throw new WorkerControlError("RUNTIME_WORKER_TASK_INVALID");
  }
  if (value.executionClass !== "passive_runtime_observation_v1"
      && value.executionClass !== "active_cors_validation_v1") {
    throw new WorkerControlError("RUNTIME_WORKER_CLASS_MISMATCH");
  }
  if (typeof value.cancelRequested !== "boolean") {
    throw new WorkerControlError("RUNTIME_WORKER_TASK_INVALID");
  }
  const priorOutcome = value.priorOutcome;
  if (priorOutcome !== null
      && priorOutcome !== "succeeded"
      && priorOutcome !== "failed"
      && priorOutcome !== "cancelled") {
    throw new WorkerControlError("RUNTIME_WORKER_TASK_INVALID");
  }
  const priorTerminalDigest = value.priorTerminalDigest;
  if (priorTerminalDigest !== null
      && (typeof priorTerminalDigest !== "string" || !DIGEST_PATTERN.test(priorTerminalDigest))) {
    throw new WorkerControlError("RUNTIME_WORKER_TASK_INVALID");
  }
  const leaseExpiresAt = nullableIso(value.leaseExpiresAt);
  if (!leaseExpiresAt) throw new WorkerControlError("RUNTIME_WORKER_TASK_INVALID");

  return Object.freeze({
    taskId: uuid(value.taskId),
    attemptId: uuid(value.attemptId),
    executionClass: value.executionClass,
    domainJobId: uuid(value.domainJobId),
    workspaceId: uuid(value.workspaceId),
    assetId: uuid(value.assetId),
    cancelRequested: value.cancelRequested,
    finishedAt: nullableIso(value.finishedAt),
    priorOutcome,
    priorTerminalDigest,
  });
}

function parseFinalize(value: unknown): { outcome: "succeeded" | "failed" | "cancelled"; replayed: boolean } {
  if (!isRecord(value)
      || Object.keys(value).sort().join(",") !== "outcome,replayed"
      || typeof value.replayed !== "boolean"
      || (value.outcome !== "succeeded" && value.outcome !== "failed" && value.outcome !== "cancelled")) {
    throw new WorkerControlError("RUNTIME_WORKER_TASK_INVALID");
  }
  return Object.freeze({ outcome: value.outcome, replayed: value.replayed });
}

function mapRpcError(message: string): WorkerControlError {
  for (const code of [
    "WORKER_LEASE_INVALID",
    "WORKER_TERMINAL_CONFLICT",
    "WORKER_JOB_STATE_CONFLICT",
    "RUNTIME_WORKER_TASK_INVALID",
    "RUNTIME_WORKER_CLASS_MISMATCH",
    "RUNTIME_WORKER_BUDGET_EXCEEDED",
  ] as const) {
    if (message.includes(code)) return new WorkerControlError(code);
  }
  return new WorkerControlError("WORKER_CONTROL_FAILED");
}

export function createRuntimeWorkerFinalizationRepository(
  client: SupabaseClient<Phase6dDatabase>,
) {
  return Object.freeze({
    async getContext(input: RuntimeWorkerPublicationIdentity): Promise<RuntimeWorkerFinalizationContext> {
      const { data, error } = await client.rpc("get_runtime_worker_finalization_context", {
        target_worker_id: input.workerId,
        target_task_id: input.taskId,
        target_attempt_id: input.attemptId,
        target_lease_token: input.leaseToken,
      });
      if (error) throw mapRpcError(error.message);
      return parseContext(data);
    },

    async finalize(input: RuntimeWorkerFinalizeInput) {
      const { data, error } = await client.rpc("finalize_runtime_worker_attempt", {
        target_worker_id: input.workerId,
        target_task_id: input.taskId,
        target_attempt_id: input.attemptId,
        target_lease_token: input.leaseToken,
        target_execution_class: input.executionClass,
        target_terminal_digest: input.terminalDigest,
        target_outcome: input.outcome,
        target_failure_code: input.failureCode,
        target_request_count: input.requestCount,
        target_redirect_count: input.redirectCount,
        target_finding_count: input.findingCount,
        target_wall_time_ms: input.metrics.wallTimeMs,
        target_cpu_time_ms: input.metrics.cpuTimeMs,
        target_peak_memory_bytes: input.metrics.peakMemoryBytes,
        target_input_bytes: input.metrics.inputBytes,
        target_output_bytes: input.metrics.outputBytes,
      });
      if (error) throw mapRpcError(error.message);
      return parseFinalize(data);
    },
  });
}

export type RuntimeWorkerFinalizationRepository = ReturnType<
  typeof createRuntimeWorkerFinalizationRepository
>;
