import type {
  Database,
  Json,
  WorkspaceRole,
} from "@/lib/database.types";
import {
  assertActiveValidationOperator,
  authorizeActiveValidationEnqueue,
  reauthorizeActiveValidationExecution,
  ActiveValidationAuthorizationError,
} from "./authorization";
import type { ActiveValidationRepository } from "./repository";
import {
  evaluateCorsPolicyRules,
  mapActiveRuntimeRuleMatchToEvidence,
  mapActiveRuntimeRuleMatchToSecurityFinding,
  validateCorsOriginPolicy,
  type ActiveValidationBudget,
  type CorsPolicyObservation,
} from "@/packages/runtime-validator";

type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
type ScanJobRow = Database["public"]["Tables"]["scan_jobs"]["Row"];

export type ActiveValidationAuditEventType =
  | "active_validation.authorized"
  | "active_validation.enqueued"
  | "active_validation.blocked"
  | "active_validation.started"
  | "active_validation.cancel_requested"
  | "active_validation.cancelled"
  | "active_validation.succeeded"
  | "active_validation.failed";

export interface ActiveValidationAuditEvent {
  workspaceId: string;
  actorId: string;
  eventType: ActiveValidationAuditEventType;
  jobId: string;
  assetId: string;
  metadata: Json;
}

export interface ActiveValidationServiceDependencies {
  repository: ActiveValidationRepository;
  loadAsset: (assetId: string, workspaceId: string) => Promise<AssetRow | null>;
  validate?: typeof validateCorsOriginPolicy;
  audit: (event: ActiveValidationAuditEvent) => Promise<void>;
  now?: () => Date;
}

export interface EnqueueActiveValidationInput {
  actorId: string | null;
  workspaceId: string;
  role: WorkspaceRole | null;
  assetId: string;
  explicitConsent: boolean;
  budget: ActiveValidationBudget;
}

export interface RequestActiveValidationCancellationInput {
  actorId: string | null;
  workspaceId: string;
  role: WorkspaceRole | null;
  jobId: string;
}

export interface ActiveValidationExecutionResult {
  status: "blocked" | "cancelled" | "failed" | "succeeded";
  job: ScanJobRow | null;
  failureCode?: string;
  reason?: string;
  requestCount?: 0 | 1;
  observation?: CorsPolicyObservation;
  findings: readonly ReturnType<typeof mapActiveRuntimeRuleMatchToSecurityFinding>[];
  evidence: readonly ReturnType<typeof mapActiveRuntimeRuleMatchToEvidence>[];
}

function clock(dependencies: ActiveValidationServiceDependencies): () => Date {
  return dependencies.now ?? (() => new Date());
}

function isMutable(job: ScanJobRow): boolean {
  return job.status === "queued" || job.status === "running";
}

async function writeAudit(
  dependencies: ActiveValidationServiceDependencies,
  event: ActiveValidationAuditEvent,
): Promise<void> {
  await dependencies.audit(event);
}

async function cancelJob(
  job: ScanJobRow,
  actorId: string,
  dependencies: ActiveValidationServiceDependencies,
  metadata: Json,
): Promise<ScanJobRow> {
  const cancelled = job.status === "cancelled"
    ? job
    : await dependencies.repository.markCancelled(job);
  await writeAudit(dependencies, {
    workspaceId: cancelled.workspace_id,
    actorId,
    eventType: "active_validation.cancelled",
    jobId: cancelled.id,
    assetId: cancelled.asset_id,
    metadata,
  });
  return cancelled;
}

async function failRunningJob(
  job: ScanJobRow,
  failureCode: string,
  actorId: string,
  requestCount: 0 | 1,
  dependencies: ActiveValidationServiceDependencies,
): Promise<ScanJobRow> {
  const failed = await dependencies.repository.markFailed(job, failureCode);
  await writeAudit(dependencies, {
    workspaceId: failed.workspace_id,
    actorId,
    eventType: "active_validation.failed",
    jobId: failed.id,
    assetId: failed.asset_id,
    metadata: { failureCode, requestCount },
  });
  return failed;
}

async function cancellationSnapshot(
  job: ScanJobRow,
  dependencies: ActiveValidationServiceDependencies,
): Promise<ScanJobRow | null> {
  const latest = await dependencies.repository.loadForWorkspace(job.id, job.workspace_id);
  if (!latest) return null;
  return latest.cancel_requested_at || latest.status === "cancelled" ? latest : null;
}

export async function enqueueActiveValidation(
  input: EnqueueActiveValidationInput,
  dependencies: ActiveValidationServiceDependencies,
) {
  const asset = await dependencies.loadAsset(input.assetId, input.workspaceId);
  const grantedAt = clock(dependencies)().toISOString();
  const authorization = authorizeActiveValidationEnqueue({
    actorId: input.actorId,
    workspaceId: input.workspaceId,
    role: input.role,
    asset,
    explicitConsent: input.explicitConsent,
    authorizationGrantedAt: grantedAt,
    budget: input.budget,
  });

  const job = await dependencies.repository.enqueue(authorization.enqueueInput);
  await writeAudit(dependencies, {
    workspaceId: job.workspace_id,
    actorId: authorization.enqueueInput.requestedBy,
    eventType: "active_validation.authorized",
    jobId: job.id,
    assetId: job.asset_id,
    metadata: {
      profileId: authorization.enqueueInput.profileId,
      profileVersion: authorization.enqueueInput.profileVersion,
      authorizationGrantedAt: grantedAt,
    },
  });
  await writeAudit(dependencies, {
    workspaceId: job.workspace_id,
    actorId: authorization.enqueueInput.requestedBy,
    eventType: "active_validation.enqueued",
    jobId: job.id,
    assetId: job.asset_id,
    metadata: { assetKind: authorization.enqueueInput.assetKind },
  });

  return Object.freeze({ job, target: authorization.target });
}

export async function executeActiveValidation(
  jobId: string,
  dependencies: ActiveValidationServiceDependencies,
): Promise<ActiveValidationExecutionResult> {
  const repository = dependencies.repository;
  const queuedJob = await repository.load(jobId);
  if (!queuedJob) {
    return Object.freeze({
      status: "blocked" as const,
      failureCode: "ACTIVE_JOB_NOT_AVAILABLE",
      reason: "The active validation job is not available.",
      job: null,
      findings: Object.freeze([]),
      evidence: Object.freeze([]),
    });
  }

  const asset = await dependencies.loadAsset(queuedJob.asset_id, queuedJob.workspace_id);
  let authorization;
  try {
    authorization = reauthorizeActiveValidationExecution({ job: queuedJob, asset });
  } catch (error) {
    if (!(error instanceof ActiveValidationAuthorizationError)) throw error;
    if (error.code === "ACTIVE_CANCELLATION_REQUESTED") {
      const cancelled = await cancelJob(queuedJob, queuedJob.requested_by, dependencies, { reasonCode: error.code });
      return Object.freeze({ status: "cancelled" as const, job: cancelled, findings: Object.freeze([]), evidence: Object.freeze([]) });
    }
    if (!isMutable(queuedJob)) {
      return Object.freeze({ status: "blocked" as const, failureCode: error.code, reason: error.reason, job: queuedJob, findings: Object.freeze([]), evidence: Object.freeze([]) });
    }
    const blocked = await repository.markBlocked(queuedJob, error.code, error.reason);
    await writeAudit(dependencies, { workspaceId: blocked.workspace_id, actorId: blocked.requested_by, eventType: "active_validation.blocked", jobId: blocked.id, assetId: blocked.asset_id, metadata: { reasonCode: error.code } });
    return Object.freeze({ status: "blocked" as const, failureCode: error.code, reason: error.reason, job: blocked, findings: Object.freeze([]), evidence: Object.freeze([]) });
  }

  const runningJob = await repository.markRunning(queuedJob);
  await writeAudit(dependencies, { workspaceId: runningJob.workspace_id, actorId: runningJob.requested_by, eventType: "active_validation.started", jobId: runningJob.id, assetId: runningJob.asset_id, metadata: { profileId: runningJob.validation_profile_id ?? "cors-origin-policy" } });

  const validate = dependencies.validate ?? validateCorsOriginPolicy;
  let cancellationJob: ScanJobRow | null = null;
  let validationResult;
  try {
    validationResult = await validate(authorization.target, authorization.budget, {
      isCancelled: async () => {
        const latest = await repository.loadForWorkspace(runningJob.id, runningJob.workspace_id);
        if (!latest) return false;
        if (latest.cancel_requested_at || latest.status === "cancelled") {
          cancellationJob = latest;
          return true;
        }
        return false;
      },
    });
  } catch {
    const failureCode = "ACTIVE_EXECUTION_ERROR";
    const failed = await failRunningJob(runningJob, failureCode, runningJob.requested_by, 0, dependencies);
    return Object.freeze({ status: "failed" as const, failureCode, job: failed, findings: Object.freeze([]), evidence: Object.freeze([]) });
  }

  if (validationResult.status === "failed") {
    const failureCode = validationResult.failureCode ?? "ACTIVE_EXECUTION_ERROR";
    const failed = await failRunningJob(runningJob, failureCode, runningJob.requested_by, validationResult.requestCount, dependencies);
    return Object.freeze({ status: "failed" as const, failureCode, job: failed, requestCount: validationResult.requestCount, findings: Object.freeze([]), evidence: Object.freeze([]) });
  }

  if (validationResult.status === "cancelled") {
    const jobToCancel = cancellationJob ?? await repository.loadForWorkspace(runningJob.id, runningJob.workspace_id) ?? runningJob;
    const cancelled = await cancelJob(jobToCancel, runningJob.requested_by, dependencies, { requestCount: validationResult.requestCount });
    return Object.freeze({ status: "cancelled" as const, job: cancelled, requestCount: validationResult.requestCount, findings: Object.freeze([]), evidence: Object.freeze([]) });
  }

  if (!validationResult.observation) {
    const failureCode = "ACTIVE_EXECUTION_ERROR";
    const failed = await failRunningJob(runningJob, failureCode, runningJob.requested_by, validationResult.requestCount, dependencies);
    return Object.freeze({ status: "failed" as const, failureCode, job: failed, requestCount: validationResult.requestCount, findings: Object.freeze([]), evidence: Object.freeze([]) });
  }

  const cancelledBeforeRules = await cancellationSnapshot(runningJob, dependencies);
  if (cancelledBeforeRules) {
    const cancelled = await cancelJob(cancelledBeforeRules, runningJob.requested_by, dependencies, { requestCount: validationResult.requestCount });
    return Object.freeze({ status: "cancelled" as const, job: cancelled, requestCount: validationResult.requestCount, findings: Object.freeze([]), evidence: Object.freeze([]) });
  }

  const matches = evaluateCorsPolicyRules({ observation: validationResult.observation });
  const evidence = Object.freeze(matches.map((match) => mapActiveRuntimeRuleMatchToEvidence({ assetRef: authorization.target.assetRef, match })));
  const findings = Object.freeze(matches.map((match) => mapActiveRuntimeRuleMatchToSecurityFinding({ assetRef: authorization.target.assetRef, match })));

  const cancelledBeforePersistence = await cancellationSnapshot(runningJob, dependencies);
  if (cancelledBeforePersistence) {
    const cancelled = await cancelJob(cancelledBeforePersistence, runningJob.requested_by, dependencies, { requestCount: validationResult.requestCount });
    return Object.freeze({ status: "cancelled" as const, job: cancelled, requestCount: validationResult.requestCount, findings: Object.freeze([]), evidence: Object.freeze([]) });
  }

  try {
    await repository.persistResult(
      runningJob,
      validationResult.observation,
      findings,
      evidence,
      authorization.budget.maxObservationBytes,
      clock(dependencies)(),
    );
  } catch {
    const cancelled = await cancellationSnapshot(runningJob, dependencies);
    if (cancelled) {
      const cancelledJob = await cancelJob(cancelled, runningJob.requested_by, dependencies, { requestCount: validationResult.requestCount });
      return Object.freeze({ status: "cancelled" as const, job: cancelledJob, requestCount: validationResult.requestCount, findings: Object.freeze([]), evidence: Object.freeze([]) });
    }
    const failureCode = "ACTIVE_EXECUTION_ERROR";
    const failed = await failRunningJob(runningJob, failureCode, runningJob.requested_by, validationResult.requestCount, dependencies);
    return Object.freeze({ status: "failed" as const, failureCode, job: failed, requestCount: validationResult.requestCount, findings: Object.freeze([]), evidence: Object.freeze([]) });
  }

  const cancelledBeforeSuccess = await cancellationSnapshot(runningJob, dependencies);
  if (cancelledBeforeSuccess) {
    const cancelled = await cancelJob(cancelledBeforeSuccess, runningJob.requested_by, dependencies, { requestCount: validationResult.requestCount });
    return Object.freeze({ status: "cancelled" as const, job: cancelled, requestCount: validationResult.requestCount, findings: Object.freeze([]), evidence: Object.freeze([]) });
  }

  let succeeded: ScanJobRow;
  try {
    succeeded = await repository.markSucceeded(runningJob, { requestCount: validationResult.requestCount, findingCount: findings.length });
  } catch {
    const cancelled = await cancellationSnapshot(runningJob, dependencies);
    if (cancelled) {
      const cancelledJob = await cancelJob(cancelled, runningJob.requested_by, dependencies, { requestCount: validationResult.requestCount });
      return Object.freeze({ status: "cancelled" as const, job: cancelledJob, requestCount: validationResult.requestCount, findings: Object.freeze([]), evidence: Object.freeze([]) });
    }
    const failureCode = "ACTIVE_EXECUTION_ERROR";
    const failed = await failRunningJob(runningJob, failureCode, runningJob.requested_by, validationResult.requestCount, dependencies);
    return Object.freeze({ status: "failed" as const, failureCode, job: failed, requestCount: validationResult.requestCount, findings: Object.freeze([]), evidence: Object.freeze([]) });
  }

  await writeAudit(dependencies, { workspaceId: succeeded.workspace_id, actorId: succeeded.requested_by, eventType: "active_validation.succeeded", jobId: succeeded.id, assetId: succeeded.asset_id, metadata: { requestCount: validationResult.requestCount, findingCount: findings.length } });

  return Object.freeze({ status: "succeeded" as const, job: succeeded, requestCount: validationResult.requestCount, observation: validationResult.observation, findings, evidence });
}

export async function requestActiveValidationCancellation(
  input: RequestActiveValidationCancellationInput,
  dependencies: ActiveValidationServiceDependencies,
) {
  const operator = { actorId: input.actorId, role: input.role };
  assertActiveValidationOperator(operator);

  const repository = dependencies.repository;
  const job = await repository.loadForWorkspace(input.jobId, input.workspaceId);
  if (!job) throw new ActiveValidationAuthorizationError("ACTIVE_JOB_NOT_AVAILABLE");
  if (!isMutable(job)) throw new ActiveValidationAuthorizationError("ACTIVE_JOB_NOT_EXECUTABLE");

  let requested = job;
  if (!job.cancel_requested_at) {
    const updated = await repository.requestCancellation(job.id, input.workspaceId);
    if (updated) requested = updated;
  }

  await writeAudit(dependencies, { workspaceId: requested.workspace_id, actorId: operator.actorId, eventType: "active_validation.cancel_requested", jobId: requested.id, assetId: requested.asset_id, metadata: { status: requested.status } });

  if (requested.status === "queued") {
    const cancelled = await cancelJob(requested, operator.actorId, dependencies, { reasonCode: "ACTIVE_CANCELLATION_REQUESTED" });
    return Object.freeze({ status: "cancelled" as const, job: cancelled });
  }

  return Object.freeze({ status: "cancellation_requested" as const, job: requested });
}
