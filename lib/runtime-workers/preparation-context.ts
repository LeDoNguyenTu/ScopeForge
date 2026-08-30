import type { SupabaseClient } from "@supabase/supabase-js";
import type { Phase6dDatabase } from "@/lib/database.phase6d.types";
import { WorkerControlError } from "@/lib/worker-control/types";
import type {
  RuntimeWorkerPreparationContext,
  RuntimeWorkerPreparationIdentity,
} from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTEXT_KEYS = Object.freeze([
  "absoluteDeadlineAt",
  "assetId",
  "attemptId",
  "domainJobId",
  "domainJobKind",
  "executionClass",
  "leaseExpiresAt",
  "requestedBy",
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

function iso(value: unknown): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new WorkerControlError("RUNTIME_WORKER_TASK_INVALID");
  }
  return value;
}

function parseContext(value: unknown): RuntimeWorkerPreparationContext {
  if (!isRecord(value)) throw new WorkerControlError("RUNTIME_WORKER_TASK_INVALID");
  const keys = Object.keys(value).sort();
  if (keys.length !== CONTEXT_KEYS.length || keys.some((key, index) => key !== CONTEXT_KEYS[index])) {
    throw new WorkerControlError("RUNTIME_WORKER_TASK_INVALID");
  }
  if (
    value.executionClass !== "passive_runtime_observation_v1"
    && value.executionClass !== "active_cors_validation_v1"
  ) {
    throw new WorkerControlError("RUNTIME_WORKER_CLASS_MISMATCH");
  }
  if (value.domainJobKind !== "passive_runtime" && value.domainJobKind !== "active_validation") {
    throw new WorkerControlError("RUNTIME_WORKER_TASK_INVALID");
  }
  return Object.freeze({
    taskId: uuid(value.taskId),
    attemptId: uuid(value.attemptId),
    executionClass: value.executionClass,
    domainJobId: uuid(value.domainJobId),
    workspaceId: uuid(value.workspaceId),
    assetId: uuid(value.assetId),
    requestedBy: uuid(value.requestedBy),
    domainJobKind: value.domainJobKind,
    leaseExpiresAt: iso(value.leaseExpiresAt),
    absoluteDeadlineAt: iso(value.absoluteDeadlineAt),
  });
}

function mapRpcError(message: string): WorkerControlError {
  for (const code of [
    "WORKER_LEASE_INVALID",
    "RUNTIME_WORKER_TASK_INVALID",
    "RUNTIME_WORKER_CLASS_MISMATCH",
  ] as const) {
    if (message.includes(code)) return new WorkerControlError(code);
  }
  return new WorkerControlError("WORKER_CONTROL_FAILED");
}

export function createRuntimeWorkerPreparationContextRepository(
  client: SupabaseClient<Phase6dDatabase>,
) {
  return Object.freeze({
    async getPreparationContext(
      input: RuntimeWorkerPreparationIdentity,
    ): Promise<RuntimeWorkerPreparationContext> {
      const { data, error } = await client.rpc("get_runtime_worker_preparation_context", {
        target_worker_id: input.workerId,
        target_task_id: input.taskId,
        target_attempt_id: input.attemptId,
        target_lease_token: input.leaseToken,
      });
      if (error) throw mapRpcError(error.message);
      const context = parseContext(data);
      if (context.taskId !== input.taskId || context.attemptId !== input.attemptId) {
        throw new WorkerControlError("WORKER_LEASE_INVALID");
      }
      return context;
    },
  });
}

export type RuntimeWorkerPreparationContextRepository = ReturnType<
  typeof createRuntimeWorkerPreparationContextRepository
>;
