import type {
  SecurityFindingRow,
  SecurityFindingWorkRow,
} from "@/lib/database.types";
import type { UpdateFindingWorkInput } from "./types";
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
}

export interface SecurityRemediationServiceDependencies {
  repository: SecurityRemediationRepositoryContract;
}

function normalizeRemediationNote(note: string | null): string | null {
  const normalized = note?.trim() ?? "";
  if (normalized.length > 2000) {
    throw new SecurityRemediationWorkflowError("SECURITY_REMEDIATION_NOTE_INVALID");
  }
  return normalized.length > 0 ? normalized : null;
}

export async function updateFindingWork(
  input: UpdateFindingWorkInput,
  dependencies: SecurityRemediationServiceDependencies,
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
