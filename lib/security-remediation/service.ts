import type {
  SecurityFindingRetestRow,
  SecurityFindingRow,
  SecurityFindingWorkRow,
} from "@/lib/database.types";
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

function normalizeRemediationNote(note: string | null): string | null {
  const normalized = note?.trim() ?? "";
  if (normalized.length > 2000) {
    throw new SecurityRemediationWorkflowError("SECURITY_REMEDIATION_NOTE_INVALID");
  }
  return normalized.length > 0 ? normalized : null;
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
