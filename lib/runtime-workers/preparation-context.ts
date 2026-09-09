import type { SupabaseClient } from "@supabase/supabase-js";
import type { Phase6dDatabase } from "@/lib/database.phase6d.types";
import { WorkerControlError } from "@/lib/worker-control/types";
import type { RuntimeWorkerPreparationCommitInput } from "./preparation";
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
const COMMIT_KEYS = Object.freeze(["jobId", "startedAt", "status"]);

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

function parseCommit(value: unknown, expectedJobId: string): void {
  if (!isRecord(value)) throw new WorkerControlError("RUNTIME_WORKER_TASK_INVALID");
  const keys = Object.keys(value).sort();
  if (keys.length !== COMMIT_KEYS.length || keys.some((key, index) => key !== COMMIT_KEYS[index])) {
    throw new WorkerControlError("RUNTIME_WORKER_TASK_INVALID");
  }
  if (uuid(value.jobId) !== expectedJobId || value.status !== "running") {
    throw new WorkerControlError("RUNTIME_WORKER_TASK_INVALID");
  }
  iso(value.startedAt);
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

function assertCommitInput(input: RuntimeWorkerPreparationCommitInput): void {
  const { identity, context, job, asset } = input;
  if (
    context.taskId !== identity.taskId
    || context.attemptId !== identity.attemptId
    || context.domainJobId !== job.id
    || context.workspaceId !== job.workspace_id
    || context.assetId !== asset.id
    || context.assetId !== job.asset_id
    || context.requestedBy !== job.requested_by
    || context.domainJobKind !== job.job_kind
    || asset.workspace_id !== context.workspaceId
    || (asset.kind !== "web_application" && asset.kind !== "api")
    || asset.verification_status !== "verified"
    || !asset.hostname
    || !asset.verified_at
    || !job.authorization_canonical_target
    || !job.authorization_asset_kind
    || !job.authorization_verified_at
  ) {
    throw new WorkerControlError("RUNTIME_WORKER_TASK_INVALID");
  }
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

    async commitPreparation(input: RuntimeWorkerPreparationCommitInput): Promise<void> {
      assertCommitInput(input);
      const { identity, job, asset } = input;
      const { data, error } = await client.rpc("commit_runtime_worker_preparation", {
        target_worker_id: identity.workerId,
        target_task_id: identity.taskId,
        target_attempt_id: identity.attemptId,
        target_lease_token: identity.leaseToken,
        target_expected_asset_canonical_target: asset.canonical_target,
        target_expected_asset_kind: asset.kind,
        target_expected_asset_hostname: asset.hostname as string,
        target_expected_asset_verified_at: asset.verified_at as string,
        target_expected_job_authorization_canonical_target: job.authorization_canonical_target as string,
        target_expected_job_authorization_asset_kind: job.authorization_asset_kind as string,
        target_expected_job_authorization_verified_at: job.authorization_verified_at as string,
        target_expected_job_validation_profile_id: job.validation_profile_id,
        target_expected_job_validation_profile_version: job.validation_profile_version,
        target_expected_job_authorization_granted_at: job.authorization_granted_at,
        target_expected_job_budget: job.budget,
      });
      if (error) throw mapRpcError(error.message);
      parseCommit(data, job.id);
    },
  });
}

export type RuntimeWorkerPreparationContextRepository = ReturnType<
  typeof createRuntimeWorkerPreparationContextRepository
>;
