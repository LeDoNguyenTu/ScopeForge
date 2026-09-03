import type { Database, WorkspaceRole } from "@/lib/database.types";
import {
  authorizeActiveValidationEnqueue,
} from "@/lib/active-validation/authorization";
import type {
  ActiveValidationAuditEvent,
} from "@/lib/active-validation/service";
import type { EnqueueActiveValidationJobInput } from "@/lib/active-validation/types";
import {
  authorizeRuntimeObservationEnqueue,
} from "@/lib/runtime-observations/authorization";
import type {
  RuntimeObservationAuditEvent,
} from "@/lib/runtime-observations/service";
import type { EnqueueRuntimeObservationJobInput } from "@/lib/runtime-observations/types";
import { RUNTIME_OBSERVATION_MAX_BUDGET } from "@/packages/runtime-observer";
import { ACTIVE_VALIDATION_MAX_BUDGET } from "@/packages/runtime-validator";
import type { RuntimeWorkerCapabilities } from "./capabilities";
import { RuntimeWorkerError } from "./errors";
import type { RuntimeWorkerEnqueueResult } from "./enqueue";

type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
type ScanJobRow = Database["public"]["Tables"]["scan_jobs"]["Row"];

export interface RuntimeWorkerRequestDependencies {
  capabilities: RuntimeWorkerCapabilities;
  loadAsset(assetId: string, workspaceId: string): Promise<AssetRow | null>;
  queuePassive(input: EnqueueRuntimeObservationJobInput): Promise<{
    job: ScanJobRow;
    workerTask: RuntimeWorkerEnqueueResult;
  }>;
  queueActive(input: EnqueueActiveValidationJobInput): Promise<{
    job: ScanJobRow;
    workerTask: RuntimeWorkerEnqueueResult;
  }>;
  auditPassive(event: RuntimeObservationAuditEvent): Promise<void>;
  auditActive(event: ActiveValidationAuditEvent): Promise<void>;
  now?: () => Date;
}

export interface PassiveRuntimeWorkerRequestInput {
  actorId: string | null;
  workspaceId: string;
  role: WorkspaceRole | null;
  assetId: string;
}

export interface ActiveCorsRuntimeWorkerRequestInput extends PassiveRuntimeWorkerRequestInput {
  explicitConsent: boolean;
}

function clock(dependencies: RuntimeWorkerRequestDependencies): Date {
  return (dependencies.now ?? (() => new Date()))();
}

export async function requestPassiveRuntimeWorker(
  input: PassiveRuntimeWorkerRequestInput,
  dependencies: RuntimeWorkerRequestDependencies,
) {
  if (!dependencies.capabilities.passiveRuntime) {
    throw new RuntimeWorkerError("RUNTIME_WORKER_UNAVAILABLE");
  }

  const asset = await dependencies.loadAsset(input.assetId, input.workspaceId);
  const authorization = authorizeRuntimeObservationEnqueue({
    actorId: input.actorId,
    workspaceId: input.workspaceId,
    role: input.role,
    asset,
    budget: RUNTIME_OBSERVATION_MAX_BUDGET,
  });
  const queued = await dependencies.queuePassive(authorization.enqueueInput);

  await dependencies.auditPassive({
    workspaceId: queued.job.workspace_id,
    actorId: authorization.enqueueInput.requestedBy,
    eventType: "runtime_observation.enqueued",
    jobId: queued.job.id,
    assetId: queued.job.asset_id,
    metadata: { assetKind: authorization.enqueueInput.assetKind },
  });

  return Object.freeze(queued);
}

export async function requestActiveCorsRuntimeWorker(
  input: ActiveCorsRuntimeWorkerRequestInput,
  dependencies: RuntimeWorkerRequestDependencies,
) {
  if (!dependencies.capabilities.activeCors) {
    throw new RuntimeWorkerError("RUNTIME_WORKER_UNAVAILABLE");
  }

  const asset = await dependencies.loadAsset(input.assetId, input.workspaceId);
  const authorizationGrantedAt = clock(dependencies).toISOString();
  const authorization = authorizeActiveValidationEnqueue({
    actorId: input.actorId,
    workspaceId: input.workspaceId,
    role: input.role,
    asset,
    explicitConsent: input.explicitConsent,
    authorizationGrantedAt,
    budget: ACTIVE_VALIDATION_MAX_BUDGET,
  });
  const queued = await dependencies.queueActive(authorization.enqueueInput);

  await dependencies.auditActive({
    workspaceId: queued.job.workspace_id,
    actorId: authorization.enqueueInput.requestedBy,
    eventType: "active_validation.authorized",
    jobId: queued.job.id,
    assetId: queued.job.asset_id,
    metadata: {
      profileId: authorization.enqueueInput.profileId,
      profileVersion: authorization.enqueueInput.profileVersion,
      authorizationGrantedAt,
    },
  });
  await dependencies.auditActive({
    workspaceId: queued.job.workspace_id,
    actorId: authorization.enqueueInput.requestedBy,
    eventType: "active_validation.enqueued",
    jobId: queued.job.id,
    assetId: queued.job.asset_id,
    metadata: { assetKind: authorization.enqueueInput.assetKind },
  });

  return Object.freeze(queued);
}
