import type {
  SecurityFindingRetestRow,
  SecurityFindingRow,
  SecurityFindingWorkRow,
  WorkspaceRole,
} from "@/lib/database.types";
import {
  enqueueRuntimeObservation,
  executeRuntimeObservation,
  type RuntimeObservationServiceDependencies,
} from "@/lib/runtime-observations/service";
import {
  enqueueActiveValidation,
  executeActiveValidation,
  type ActiveValidationServiceDependencies,
} from "@/lib/active-validation/service";
import { RUNTIME_OBSERVATION_MAX_BUDGET } from "@/packages/runtime-observer";
import { ACTIVE_VALIDATION_MAX_BUDGET } from "@/packages/runtime-validator";
import { resolveRetestSource } from "./source-registry";
import type { RequestFindingRetestInput, UpdateFindingWorkInput } from "./types";
import { SecurityRemediationWorkflowError } from "./types";

export { SecurityRemediationWorkflowError } from "./types";

export interface SecurityRemediationRepositoryContract {
  loadFinding(workspaceId: string, findingId: string): Promise<SecurityFindingRow | null>;
  changeFindingWork(input: {
    workspaceId: string;
    findingId: string;
    actorId: string;
    assigneeUserId: string | null;
    remediationNote: string | null;
  }): Promise<SecurityFindingWorkRow>;
  requestFindingRetest(input: {
    workspaceId: string;
    findingId: string;
    actorId: string;
    executionKind: "passive_runtime" | "active_validation";
    sourceId: string;
    sourceVersion: string | null;
    ruleRef: string;
    validationProfileId: "cors-origin-policy" | null;
    validationProfileVersion: 1 | null;
    explicitConsent: boolean;
  }): Promise<SecurityFindingRetestRow>;
  markRetestRunning(input: {
    workspaceId: string;
    retestId: string;
    scanJobId: string;
    actorId: string;
  }): Promise<SecurityFindingRetestRow>;
  finalizeRetest(input: {
    workspaceId: string;
    retestId: string;
  }): Promise<SecurityFindingRetestRow>;
}

export interface SecurityRemediationServiceDependencies {
  repository: SecurityRemediationRepositoryContract;
}

type FindingWorkServiceDependencies = {
  repository: Pick<
    SecurityRemediationRepositoryContract,
    "loadFinding" | "changeFindingWork"
  >;
};

type FindingRetestRequestServiceDependencies = {
  repository: Pick<
    SecurityRemediationRepositoryContract,
    "loadFinding" | "requestFindingRetest"
  >;
};

type FindingRetestRunningServiceDependencies = {
  repository: Pick<SecurityRemediationRepositoryContract, "markRetestRunning">;
};

type FindingRetestFinalizationServiceDependencies = {
  repository: Pick<SecurityRemediationRepositoryContract, "finalizeRetest">;
};

type RuntimeRetestEnqueue = (
  input: Parameters<typeof enqueueRuntimeObservation>[0],
  dependencies: RuntimeObservationServiceDependencies,
) => Promise<{ job: { id: string } }>;

type RuntimeRetestExecute = (
  jobId: string,
  dependencies: RuntimeObservationServiceDependencies,
) => Promise<unknown>;

type ActiveRetestEnqueue = (
  input: Parameters<typeof enqueueActiveValidation>[0],
  dependencies: ActiveValidationServiceDependencies,
) => Promise<{ job: { id: string } }>;

type ActiveRetestExecute = (
  jobId: string,
  dependencies: ActiveValidationServiceDependencies,
) => Promise<unknown>;

export interface FindingRetestExecutionDependencies {
  repository: Pick<
    SecurityRemediationRepositoryContract,
    "markRetestRunning" | "finalizeRetest"
  >;
  runtimeDependencies: RuntimeObservationServiceDependencies;
  activeDependencies: ActiveValidationServiceDependencies;
  enqueueRuntimeObservation?: RuntimeRetestEnqueue;
  executeRuntimeObservation?: RuntimeRetestExecute;
  enqueueActiveValidation?: ActiveRetestEnqueue;
  executeActiveValidation?: ActiveRetestExecute;
}

export interface ExecuteFindingRetestInput {
  actorId: string;
  workspaceId: string;
  role: WorkspaceRole;
  retest: SecurityFindingRetestRow;
}

function normalizeRemediationNote(note: string | null): string | null {
  const normalized = note?.trim() ?? "";
  if (normalized.length > 2000) {
    throw new SecurityRemediationWorkflowError("SECURITY_REMEDIATION_NOTE_INVALID");
  }
  return normalized.length > 0 ? normalized : null;
}

function assertRequestedRetest(input: ExecuteFindingRetestInput): void {
  const { retest } = input;
  if (
    retest.workspace_id !== input.workspaceId
    || retest.requested_by !== input.actorId
    || retest.status !== "requested"
    || retest.scan_job_id !== null
    || retest.started_at !== null
    || retest.completed_at !== null
  ) {
    throw new SecurityRemediationWorkflowError("SECURITY_RETEST_NOT_AVAILABLE");
  }
}

function assertPassiveRetestSnapshot(retest: SecurityFindingRetestRow): void {
  if (
    retest.source_id !== "scopeforge:runtime-observer"
    || retest.source_version !== "0.1"
    || retest.validation_profile_id !== null
    || retest.validation_profile_version !== null
    || retest.active_consent_granted_at !== null
  ) {
    throw new SecurityRemediationWorkflowError("SECURITY_RETEST_UNSUPPORTED_SOURCE");
  }
}

function assertActiveRetestSnapshot(retest: SecurityFindingRetestRow): void {
  if (
    retest.source_id !== "scopeforge:runtime-validator"
    || retest.source_version !== "cors-origin-policy@1"
    || retest.validation_profile_id !== "cors-origin-policy"
    || retest.validation_profile_version !== 1
  ) {
    throw new SecurityRemediationWorkflowError("SECURITY_RETEST_UNSUPPORTED_SOURCE");
  }
  if (retest.active_consent_granted_at === null) {
    throw new SecurityRemediationWorkflowError("SECURITY_RETEST_CONSENT_REQUIRED");
  }
}

export async function updateFindingWork(
  input: UpdateFindingWorkInput,
  dependencies: FindingWorkServiceDependencies,
): Promise<SecurityFindingWorkRow> {
  if (input.role === "viewer") {
    throw new SecurityRemediationWorkflowError("SECURITY_REMEDIATION_FORBIDDEN");
  }

  if (
    input.role === "member"
    && input.assigneeUserId !== null
    && input.assigneeUserId !== input.actorId
  ) {
    throw new SecurityRemediationWorkflowError("SECURITY_REMEDIATION_FORBIDDEN");
  }

  const remediationNote = normalizeRemediationNote(input.remediationNote);
  const finding = await dependencies.repository.loadFinding(input.workspaceId, input.findingId);
  if (!finding) {
    throw new SecurityRemediationWorkflowError("SECURITY_REMEDIATION_FINDING_NOT_AVAILABLE");
  }

  return dependencies.repository.changeFindingWork({
    workspaceId: input.workspaceId,
    findingId: input.findingId,
    actorId: input.actorId,
    assigneeUserId: input.assigneeUserId,
    remediationNote,
  });
}

export async function requestFindingRetest(
  input: RequestFindingRetestInput,
  dependencies: FindingRetestRequestServiceDependencies,
): Promise<SecurityFindingRetestRow> {
  if (input.role === "viewer") {
    throw new SecurityRemediationWorkflowError("SECURITY_RETEST_FORBIDDEN");
  }

  const finding = await dependencies.repository.loadFinding(input.workspaceId, input.findingId);
  if (!finding) {
    throw new SecurityRemediationWorkflowError("SECURITY_REMEDIATION_FINDING_NOT_AVAILABLE");
  }
  if (finding.lifecycle_state !== "resolved") {
    throw new SecurityRemediationWorkflowError("SECURITY_RETEST_STATE_INVALID");
  }

  const source = resolveRetestSource(finding);
  if (!source) {
    throw new SecurityRemediationWorkflowError("SECURITY_RETEST_UNSUPPORTED_SOURCE");
  }

  if (source.executionKind === "active_validation") {
    if (input.role !== "owner" && input.role !== "admin") {
      throw new SecurityRemediationWorkflowError("SECURITY_RETEST_FORBIDDEN");
    }
    if (!input.explicitConsent) {
      throw new SecurityRemediationWorkflowError("SECURITY_RETEST_CONSENT_REQUIRED");
    }
  }

  return dependencies.repository.requestFindingRetest({
    workspaceId: input.workspaceId,
    findingId: input.findingId,
    actorId: input.actorId,
    executionKind: source.executionKind,
    sourceId: source.sourceId,
    sourceVersion: source.sourceVersion,
    ruleRef: finding.rule_ref,
    validationProfileId: source.validationProfileId,
    validationProfileVersion: source.validationProfileVersion,
    explicitConsent: source.executionKind === "active_validation",
  });
}

export async function markRetestRunning(
  input: {
    workspaceId: string;
    retestId: string;
    scanJobId: string;
    actorId: string;
  },
  dependencies: FindingRetestRunningServiceDependencies,
): Promise<SecurityFindingRetestRow> {
  return dependencies.repository.markRetestRunning(input);
}

export async function finalizeRetest(
  input: {
    workspaceId: string;
    retestId: string;
  },
  dependencies: FindingRetestFinalizationServiceDependencies,
): Promise<SecurityFindingRetestRow> {
  return dependencies.repository.finalizeRetest(input);
}

export async function executeFindingRetest(
  input: ExecuteFindingRetestInput,
  dependencies: FindingRetestExecutionDependencies,
): Promise<SecurityFindingRetestRow> {
  assertRequestedRetest(input);

  if (input.retest.execution_kind === "passive_runtime") {
    assertPassiveRetestSnapshot(input.retest);
    const enqueue = dependencies.enqueueRuntimeObservation ?? enqueueRuntimeObservation;
    const execute = dependencies.executeRuntimeObservation ?? executeRuntimeObservation;
    const queued = await enqueue({
      actorId: input.actorId,
      workspaceId: input.workspaceId,
      role: input.role,
      assetId: input.retest.asset_id,
      budget: RUNTIME_OBSERVATION_MAX_BUDGET,
    }, dependencies.runtimeDependencies);

    await dependencies.repository.markRetestRunning({
      workspaceId: input.workspaceId,
      retestId: input.retest.id,
      scanJobId: queued.job.id,
      actorId: input.actorId,
    });
    await execute(queued.job.id, dependencies.runtimeDependencies);
  } else if (input.retest.execution_kind === "active_validation") {
    assertActiveRetestSnapshot(input.retest);
    const enqueue = dependencies.enqueueActiveValidation ?? enqueueActiveValidation;
    const execute = dependencies.executeActiveValidation ?? executeActiveValidation;
    const queued = await enqueue({
      actorId: input.actorId,
      workspaceId: input.workspaceId,
      role: input.role,
      assetId: input.retest.asset_id,
      explicitConsent: true,
      budget: ACTIVE_VALIDATION_MAX_BUDGET,
    }, dependencies.activeDependencies);

    await dependencies.repository.markRetestRunning({
      workspaceId: input.workspaceId,
      retestId: input.retest.id,
      scanJobId: queued.job.id,
      actorId: input.actorId,
    });
    await execute(queued.job.id, dependencies.activeDependencies);
  } else {
    throw new SecurityRemediationWorkflowError("SECURITY_RETEST_UNSUPPORTED_SOURCE");
  }

  return dependencies.repository.finalizeRetest({
    workspaceId: input.workspaceId,
    retestId: input.retest.id,
  });
}
