import type { Database } from "@/lib/database.types";
import {
  reauthorizeActiveValidationExecution,
  ActiveValidationAuthorizationError,
} from "@/lib/active-validation/authorization";
import {
  reauthorizeRuntimeObservationExecution,
  RuntimeAuthorizationError,
} from "@/lib/runtime-observations/authorization";
import { RuntimeWorkerError } from "./errors";
import type {
  PreparedRuntimeWorkerExecution,
  RuntimeWorkerPreparationContext,
  RuntimeWorkerPreparationIdentity,
} from "./types";

type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
type ScanJobRow = Database["public"]["Tables"]["scan_jobs"]["Row"];

export interface RuntimeWorkerPreparationDependencies {
  getPreparationContext(
    input: RuntimeWorkerPreparationIdentity,
  ): Promise<RuntimeWorkerPreparationContext>;
  loadAsset(assetId: string, workspaceId: string): Promise<AssetRow | null>;
  loadPassiveJob(jobId: string, workspaceId: string): Promise<ScanJobRow | null>;
  loadActiveJob(jobId: string, workspaceId: string): Promise<ScanJobRow | null>;
  markPassiveRunning(job: ScanJobRow): Promise<ScanJobRow>;
  markActiveRunning(job: ScanJobRow): Promise<ScanJobRow>;
  now?: () => Date;
}

function clock(dependencies: RuntimeWorkerPreparationDependencies): Date {
  return (dependencies.now ?? (() => new Date()))();
}

function contextExpiry(context: RuntimeWorkerPreparationContext, now: Date): string {
  const lease = Date.parse(context.leaseExpiresAt);
  const deadline = Date.parse(context.absoluteDeadlineAt);
  if (!Number.isFinite(lease) || !Number.isFinite(deadline)) {
    throw new RuntimeWorkerError("RUNTIME_WORKER_TASK_INVALID");
  }
  const expiresAt = Math.min(lease, deadline);
  if (expiresAt <= now.getTime()) {
    throw new RuntimeWorkerError("RUNTIME_WORKER_TASK_INVALID");
  }
  return new Date(expiresAt).toISOString();
}

function assertContextPairing(context: RuntimeWorkerPreparationContext): void {
  const valid = context.executionClass === "passive_runtime_observation_v1"
    ? context.domainJobKind === "passive_runtime"
    : context.domainJobKind === "active_validation";
  if (!valid) throw new RuntimeWorkerError("RUNTIME_WORKER_TASK_INVALID");
}

function assertJobBinding(job: ScanJobRow | null, context: RuntimeWorkerPreparationContext): asserts job is ScanJobRow {
  if (
    !job
    || job.id !== context.domainJobId
    || job.workspace_id !== context.workspaceId
    || job.asset_id !== context.assetId
    || job.requested_by !== context.requestedBy
    || job.job_kind !== context.domainJobKind
  ) {
    throw new RuntimeWorkerError("RUNTIME_WORKER_TASK_INVALID");
  }
}

function authorizationFailure(error: unknown): never {
  if (error instanceof RuntimeAuthorizationError || error instanceof ActiveValidationAuthorizationError) {
    throw new RuntimeWorkerError("RUNTIME_WORKER_AUTHORIZATION_FAILED");
  }
  throw error;
}

export async function prepareRuntimeWorkerExecution(
  input: RuntimeWorkerPreparationIdentity,
  dependencies: RuntimeWorkerPreparationDependencies,
): Promise<PreparedRuntimeWorkerExecution> {
  const context = await dependencies.getPreparationContext(input);
  if (context.taskId !== input.taskId || context.attemptId !== input.attemptId) {
    throw new RuntimeWorkerError("RUNTIME_WORKER_TASK_INVALID");
  }
  assertContextPairing(context);
  const expiresAt = contextExpiry(context, clock(dependencies));
  const asset = await dependencies.loadAsset(context.assetId, context.workspaceId);

  if (context.executionClass === "passive_runtime_observation_v1") {
    const job = await dependencies.loadPassiveJob(context.domainJobId, context.workspaceId);
    assertJobBinding(job, context);
    let authorization;
    try {
      authorization = reauthorizeRuntimeObservationExecution({ job, asset });
    } catch (error) {
      return authorizationFailure(error);
    }
    try {
      await dependencies.markPassiveRunning(job);
    } catch {
      throw new RuntimeWorkerError("RUNTIME_WORKER_AUTHORIZATION_FAILED");
    }
    return Object.freeze({
      taskId: context.taskId,
      attemptId: context.attemptId,
      executionClass: context.executionClass,
      domainJobId: context.domainJobId,
      expiresAt,
      target: authorization.target,
      budget: authorization.budget,
    });
  }

  const job = await dependencies.loadActiveJob(context.domainJobId, context.workspaceId);
  assertJobBinding(job, context);
  let authorization;
  try {
    authorization = reauthorizeActiveValidationExecution({ job, asset });
  } catch (error) {
    return authorizationFailure(error);
  }
  try {
    await dependencies.markActiveRunning(job);
  } catch {
    throw new RuntimeWorkerError("RUNTIME_WORKER_AUTHORIZATION_FAILED");
  }
  return Object.freeze({
    taskId: context.taskId,
    attemptId: context.attemptId,
    executionClass: context.executionClass,
    domainJobId: context.domainJobId,
    expiresAt,
    target: authorization.target,
    budget: authorization.budget,
  });
}
