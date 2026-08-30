import { writeAuditEvent } from "@/lib/audit/write-audit-event";
import type { Database, Json } from "@/lib/database.types";
import type { Phase6dDatabase } from "@/lib/database.phase6d.types";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EnqueueActiveValidationJobInput } from "@/lib/active-validation/types";
import type { ActiveValidationAuditEvent } from "@/lib/active-validation/service";
import type { EnqueueRuntimeObservationJobInput } from "@/lib/runtime-observations/types";
import type { RuntimeObservationAuditEvent } from "@/lib/runtime-observations/service";
import { readRuntimeWorkerCapabilities } from "./capabilities";
import { RuntimeWorkerError } from "./errors";
import type { RuntimeWorkerEnqueueResult } from "./enqueue";
import type { RuntimeWorkerRequestDependencies } from "./request";

type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
type ScanJobRow = Database["public"]["Tables"]["scan_jobs"]["Row"];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseWorkerTask(
  value: unknown,
  expectedClass: RuntimeWorkerEnqueueResult["executionClass"],
): RuntimeWorkerEnqueueResult {
  if (!isRecord(value)) throw new RuntimeWorkerError("RUNTIME_WORKER_TASK_INVALID");
  const keys = Object.keys(value).sort();
  const expectedKeys = ["absoluteDeadlineAt", "executionClass", "scanJobId", "taskId"];
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    throw new RuntimeWorkerError("RUNTIME_WORKER_TASK_INVALID");
  }
  if (
    typeof value.scanJobId !== "string"
    || !UUID_PATTERN.test(value.scanJobId)
    || typeof value.taskId !== "string"
    || !UUID_PATTERN.test(value.taskId)
    || value.executionClass !== expectedClass
    || typeof value.absoluteDeadlineAt !== "string"
    || !Number.isFinite(Date.parse(value.absoluteDeadlineAt))
  ) {
    throw new RuntimeWorkerError("RUNTIME_WORKER_TASK_INVALID");
  }
  return Object.freeze({
    scanJobId: value.scanJobId,
    taskId: value.taskId,
    executionClass: value.executionClass,
    absoluteDeadlineAt: value.absoluteDeadlineAt,
  });
}

function mapRequestRpcError(message: string): never {
  if (message.includes("RUNTIME_WORKER_ACTIVE_LIMIT")) {
    throw new RuntimeWorkerError("RUNTIME_WORKER_BUSY");
  }
  if (message.includes("RUNTIME_WORKER_ACCESS_DENIED")) {
    throw new RuntimeWorkerError("RUNTIME_WORKER_AUTHORIZATION_FAILED");
  }
  throw new RuntimeWorkerError("RUNTIME_WORKER_TASK_INVALID");
}

function assertQueuedJob(
  job: ScanJobRow | null,
  input: EnqueueRuntimeObservationJobInput | EnqueueActiveValidationJobInput,
  expectedKind: "passive_runtime" | "active_validation",
): asserts job is ScanJobRow {
  if (
    !job
    || job.workspace_id !== input.workspaceId
    || job.asset_id !== input.assetId
    || job.requested_by !== input.requestedBy
    || job.job_kind !== expectedKind
    || job.status !== "queued"
    || job.cancel_requested_at !== null
    || job.authorization_canonical_target !== input.canonicalTarget
    || job.authorization_asset_kind !== input.assetKind
    || job.authorization_verified_at !== input.verifiedAt
  ) {
    throw new RuntimeWorkerError("RUNTIME_WORKER_TASK_INVALID");
  }
}

export function createRuntimeWorkerRequestServerDependencies(): RuntimeWorkerRequestDependencies {
  const admin = createAdminClient<Phase6dDatabase>();

  async function loadAsset(assetId: string, workspaceId: string): Promise<AssetRow | null> {
    const { data, error } = await admin
      .from("assets")
      .select("*")
      .eq("id", assetId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) throw new RuntimeWorkerError("RUNTIME_WORKER_AUTHORIZATION_FAILED");
    return data as AssetRow | null;
  }

  async function loadQueuedJob(scanJobId: string): Promise<ScanJobRow | null> {
    const { data, error } = await admin
      .from("scan_jobs")
      .select("*")
      .eq("id", scanJobId)
      .maybeSingle();
    if (error) throw new RuntimeWorkerError("RUNTIME_WORKER_TASK_INVALID");
    return data as ScanJobRow | null;
  }

  async function queuePassive(input: EnqueueRuntimeObservationJobInput) {
    const { data, error } = await admin.rpc("request_passive_runtime_worker_job", {
      target_workspace_id: input.workspaceId,
      target_asset_id: input.assetId,
      target_actor_id: input.requestedBy,
      target_canonical_target: input.canonicalTarget,
      target_asset_kind: input.assetKind,
      target_verified_at: input.verifiedAt,
      target_budget: toJson(input.budget),
    });
    if (error) return mapRequestRpcError(error.message);
    const workerTask = parseWorkerTask(data, "passive_runtime_observation_v1");
    const job = await loadQueuedJob(workerTask.scanJobId);
    assertQueuedJob(job, input, "passive_runtime");
    return Object.freeze({ job, workerTask });
  }

  async function queueActive(input: EnqueueActiveValidationJobInput) {
    const { data, error } = await admin.rpc("request_active_cors_worker_job", {
      target_workspace_id: input.workspaceId,
      target_asset_id: input.assetId,
      target_actor_id: input.requestedBy,
      target_canonical_target: input.canonicalTarget,
      target_asset_kind: input.assetKind,
      target_verified_at: input.verifiedAt,
      target_profile_id: input.profileId,
      target_profile_version: input.profileVersion,
      target_authorization_granted_at: input.authorizationGrantedAt,
      target_budget: toJson(input.budget),
    });
    if (error) return mapRequestRpcError(error.message);
    const workerTask = parseWorkerTask(data, "active_cors_validation_v1");
    const job = await loadQueuedJob(workerTask.scanJobId);
    assertQueuedJob(job, input, "active_validation");
    if (
      job.validation_profile_id !== input.profileId
      || job.validation_profile_version !== input.profileVersion
      || job.authorization_granted_at !== input.authorizationGrantedAt
    ) {
      throw new RuntimeWorkerError("RUNTIME_WORKER_TASK_INVALID");
    }
    return Object.freeze({ job, workerTask });
  }

  async function auditPassive(event: RuntimeObservationAuditEvent): Promise<void> {
    await writeAuditEvent({
      supabase: admin,
      workspaceId: event.workspaceId,
      eventType: event.eventType,
      actorId: event.actorId,
      targetType: "asset",
      targetId: event.assetId,
      metadata: { jobId: event.jobId, details: event.metadata },
    });
  }

  async function auditActive(event: ActiveValidationAuditEvent): Promise<void> {
    await writeAuditEvent({
      supabase: admin,
      workspaceId: event.workspaceId,
      eventType: event.eventType,
      actorId: event.actorId,
      targetType: "asset",
      targetId: event.assetId,
      metadata: { jobId: event.jobId, details: event.metadata },
    });
  }

  return Object.freeze({
    capabilities: readRuntimeWorkerCapabilities(),
    loadAsset,
    queuePassive,
    queueActive,
    auditPassive,
    auditActive,
  });
}
