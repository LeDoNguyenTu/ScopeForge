import type {
  Database,
  Json,
  WorkspaceRole,
} from "@/lib/database.types";
import {
  assertRuntimeObservationOperator,
  authorizeRuntimeObservationEnqueue,
  reauthorizeRuntimeObservationExecution,
  RuntimeAuthorizationError,
} from "./authorization";
import type { RuntimeObservationRepository } from "./repository";
import {
  evaluateRuntimeRules,
  mapRuntimeRuleMatchToEvidence,
  mapRuntimeRuleMatchToSecurityFinding,
  observeRuntimeTarget,
  type RuntimeObservationBudget,
  type RuntimeObservationResult,
} from "@/packages/runtime-observer";

type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
type ScanJobRow = Database["public"]["Tables"]["scan_jobs"]["Row"];

export type RuntimeObservationAuditEventType =
  | "runtime_observation.enqueued"
  | "runtime_observation.blocked"
  | "runtime_observation.started"
  | "runtime_observation.cancel_requested"
  | "runtime_observation.cancelled"
  | "runtime_observation.succeeded"
  | "runtime_observation.failed";

export interface RuntimeObservationAuditEvent {
  workspaceId: string;
  actorId: string;
  eventType: RuntimeObservationAuditEventType;
  jobId: string;
  assetId: string;
  metadata: Json;
}

export interface RuntimeObservationServiceDependencies {
  repository: RuntimeObservationRepository;
  loadAsset: (assetId: string, workspaceId: string) => Promise<AssetRow | null>;
  observe?: typeof observeRuntimeTarget;
  audit: (event: RuntimeObservationAuditEvent) => Promise<void>;
  now?: () => Date;
}

export interface EnqueueRuntimeObservationInput {
  actorId: string | null;
  workspaceId: string;
  role: WorkspaceRole | null;
  assetId: string;
  budget: RuntimeObservationBudget;
}

export interface RequestRuntimeObservationCancellationInput {
  actorId: string | null;
  workspaceId: string;
  role: WorkspaceRole | null;
  jobId: string;
}

function clock(dependencies: RuntimeObservationServiceDependencies): () => Date {
  return dependencies.now ?? (() => new Date());
}

function isMutableRuntimeJob(job: ScanJobRow): boolean {
  return job.status === "queued" || job.status === "running";
}

async function writeAudit(
  dependencies: RuntimeObservationServiceDependencies,
  event: RuntimeObservationAuditEvent,
): Promise<void> {
  await dependencies.audit(event);
}

async function cancelJob(
  job: ScanJobRow,
  actorId: string,
  dependencies: RuntimeObservationServiceDependencies,
  metadata: Json,
) {
  const cancelled = await dependencies.repository.markCancelled(job);
  await writeAudit(dependencies, {
    workspaceId: cancelled.workspace_id,
    actorId,
    eventType: "runtime_observation.cancelled",
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
  result: Pick<RuntimeObservationResult, "requestCount" | "redirectCount">,
  dependencies: RuntimeObservationServiceDependencies,
) {
  const failed = await dependencies.repository.markFailed(job, failureCode);
  await writeAudit(dependencies, {
    workspaceId: failed.workspace_id,
    actorId,
    eventType: "runtime_observation.failed",
    jobId: failed.id,
    assetId: failed.asset_id,
    metadata: {
      failureCode,
      requestCount: result.requestCount,
      redirectCount: result.redirectCount,
    },
  });
  return failed;
}

export async function enqueueRuntimeObservation(
  input: EnqueueRuntimeObservationInput,
  dependencies: RuntimeObservationServiceDependencies,
) {
  const asset = await dependencies.loadAsset(input.assetId, input.workspaceId);
  const authorization = authorizeRuntimeObservationEnqueue({
    actorId: input.actorId,
    workspaceId: input.workspaceId,
    role: input.role,
    asset,
    budget: input.budget,
  });

  const job = await dependencies.repository.enqueue(authorization.enqueueInput);
  await writeAudit(dependencies, {
    workspaceId: job.workspace_id,
    actorId: authorization.enqueueInput.requestedBy,
    eventType: "runtime_observation.enqueued",
    jobId: job.id,
    assetId: job.asset_id,
    metadata: { assetKind: authorization.enqueueInput.assetKind },
  });

  return Object.freeze({ job, target: authorization.target });
}

export async function executeRuntimeObservation(
  jobId: string,
  dependencies: RuntimeObservationServiceDependencies,
) {
  const repository = dependencies.repository;
  const queuedJob = await repository.load(jobId);
  if (!queuedJob) {
    return Object.freeze({
      status: "blocked" as const,
      failureCode: "RUNTIME_JOB_NOT_AVAILABLE" as const,
      reason: "The passive observation job is not available.",
      job: null,
      findings: Object.freeze([]),
      evidence: Object.freeze([]),
    });
  }

  const asset = await dependencies.loadAsset(queuedJob.asset_id, queuedJob.workspace_id);
  let authorization;
  try {
    authorization = reauthorizeRuntimeObservationExecution({
      job: queuedJob,
      asset,
    });
  } catch (error) {
    if (!(error instanceof RuntimeAuthorizationError)) throw error;

    if (error.code === "RUNTIME_CANCELLATION_REQUESTED") {
      const cancelled = await cancelJob(
        queuedJob,
        queuedJob.requested_by,
        dependencies,
        { reasonCode: error.code },
      );
      return Object.freeze({
        status: "cancelled" as const,
        job: cancelled,
        findings: Object.freeze([]),
        evidence: Object.freeze([]),
      });
    }

    if (!isMutableRuntimeJob(queuedJob)) {
      return Object.freeze({
        status: "blocked" as const,
        failureCode: error.code,
        reason: error.reason,
        job: queuedJob,
        findings: Object.freeze([]),
        evidence: Object.freeze([]),
      });
    }

    const blocked = await repository.markBlocked(queuedJob, error.code, error.reason);
    await writeAudit(dependencies, {
      workspaceId: blocked.workspace_id,
      actorId: blocked.requested_by,
      eventType: "runtime_observation.blocked",
      jobId: blocked.id,
      assetId: blocked.asset_id,
      metadata: { reasonCode: error.code },
    });
    return Object.freeze({
      status: "blocked" as const,
      failureCode: error.code,
      reason: error.reason,
      job: blocked,
      findings: Object.freeze([]),
      evidence: Object.freeze([]),
    });
  }

  const runningJob = await repository.markRunning(queuedJob);
  await writeAudit(dependencies, {
    workspaceId: runningJob.workspace_id,
    actorId: runningJob.requested_by,
    eventType: "runtime_observation.started",
    jobId: runningJob.id,
    assetId: runningJob.asset_id,
    metadata: { jobKind: "passive_runtime" },
  });

  const observe = dependencies.observe ?? observeRuntimeTarget;
  const now = clock(dependencies);
  let observationResult: RuntimeObservationResult;
  try {
    observationResult = await observe(
      authorization.target,
      authorization.budget,
      { now: () => now().getTime() },
    );
  } catch {
    const failureCode = "RUNTIME_EXECUTION_ERROR";
    const failed = await failRunningJob(
      runningJob,
      failureCode,
      runningJob.requested_by,
      { requestCount: 0, redirectCount: 0 },
      dependencies,
    );
    return Object.freeze({
      status: "failed" as const,
      failureCode,
      job: failed,
      findings: Object.freeze([]),
      evidence: Object.freeze([]),
    });
  }

  if (observationResult.status === "failed") {
    const failureCode = observationResult.failureCode ?? "RUNTIME_EXECUTION_ERROR";
    const failed = await failRunningJob(
      runningJob,
      failureCode,
      runningJob.requested_by,
      observationResult,
      dependencies,
    );
    return Object.freeze({
      status: "failed" as const,
      failureCode,
      job: failed,
      requestCount: observationResult.requestCount,
      redirectCount: observationResult.redirectCount,
      findings: Object.freeze([]),
      evidence: Object.freeze([]),
    });
  }

  if (observationResult.status === "cancelled") {
    const cancelled = await cancelJob(
      runningJob,
      runningJob.requested_by,
      dependencies,
      {
        requestCount: observationResult.requestCount,
        redirectCount: observationResult.redirectCount,
      },
    );
    return Object.freeze({
      status: "cancelled" as const,
      job: cancelled,
      requestCount: observationResult.requestCount,
      redirectCount: observationResult.redirectCount,
      findings: Object.freeze([]),
      evidence: Object.freeze([]),
    });
  }

  const latestJob = await repository.load(runningJob.id);
  if (latestJob?.cancel_requested_at && latestJob.status === "running") {
    const cancelled = await cancelJob(
      latestJob,
      latestJob.requested_by,
      dependencies,
      {
        requestCount: observationResult.requestCount,
        redirectCount: observationResult.redirectCount,
      },
    );
    return Object.freeze({
      status: "cancelled" as const,
      job: cancelled,
      requestCount: observationResult.requestCount,
      redirectCount: observationResult.redirectCount,
      findings: Object.freeze([]),
      evidence: Object.freeze([]),
    });
  }

  const matches = evaluateRuntimeRules({
    observations: observationResult.observations,
    now: now(),
  });
  const evidence = Object.freeze(matches.map((match) =>
    mapRuntimeRuleMatchToEvidence({ assetRef: authorization.target.assetRef, match })));
  const findings = Object.freeze(matches.map((match) =>
    mapRuntimeRuleMatchToSecurityFinding({ assetRef: authorization.target.assetRef, match })));

  try {
    await repository.persistObservations(
      runningJob,
      observationResult.observations,
      authorization.budget.maxObservationBytes,
    );
  } catch {
    const failureCode = "RUNTIME_EXECUTION_ERROR";
    const failed = await failRunningJob(
      runningJob,
      failureCode,
      runningJob.requested_by,
      observationResult,
      dependencies,
    );
    return Object.freeze({
      status: "failed" as const,
      failureCode,
      job: failed,
      requestCount: observationResult.requestCount,
      redirectCount: observationResult.redirectCount,
      findings: Object.freeze([]),
      evidence: Object.freeze([]),
    });
  }

  const succeeded = await repository.markSucceeded(runningJob, {
    requestCount: observationResult.requestCount,
    redirectCount: observationResult.redirectCount,
    findingCount: findings.length,
  });
  await writeAudit(dependencies, {
    workspaceId: succeeded.workspace_id,
    actorId: succeeded.requested_by,
    eventType: "runtime_observation.succeeded",
    jobId: succeeded.id,
    assetId: succeeded.asset_id,
    metadata: {
      requestCount: observationResult.requestCount,
      redirectCount: observationResult.redirectCount,
      findingCount: findings.length,
    },
  });

  return Object.freeze({
    status: "succeeded" as const,
    job: succeeded,
    requestCount: observationResult.requestCount,
    redirectCount: observationResult.redirectCount,
    observations: observationResult.observations,
    findings,
    evidence,
  });
}

export async function requestRuntimeObservationCancellation(
  input: RequestRuntimeObservationCancellationInput,
  dependencies: RuntimeObservationServiceDependencies,
) {
  assertRuntimeObservationOperator({
    actorId: input.actorId,
    role: input.role,
  });

  const repository = dependencies.repository;
  const job = await repository.loadForWorkspace(input.jobId, input.workspaceId);
  if (!job) throw new RuntimeAuthorizationError("RUNTIME_JOB_NOT_AVAILABLE");
  if (!isMutableRuntimeJob(job)) {
    throw new RuntimeAuthorizationError("RUNTIME_JOB_NOT_EXECUTABLE");
  }

  let requested = job;
  if (!job.cancel_requested_at) {
    const updated = await repository.requestCancellation(job.id, input.workspaceId);
    if (updated) requested = updated;
  }

  await writeAudit(dependencies, {
    workspaceId: requested.workspace_id,
    actorId: input.actorId,
    eventType: "runtime_observation.cancel_requested",
    jobId: requested.id,
    assetId: requested.asset_id,
    metadata: { status: requested.status },
  });

  if (requested.status === "queued") {
    const cancelled = await cancelJob(
      requested,
      input.actorId,
      dependencies,
      { reasonCode: "RUNTIME_CANCELLATION_REQUESTED" },
    );
    return Object.freeze({ status: "cancelled" as const, job: cancelled });
  }

  return Object.freeze({ status: "cancellation_requested" as const, job: requested });
}
