import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  SecurityFindingRow,
  SecurityFindingWorkRow,
} from "@/lib/database.types";
import {
  SecurityRemediationWorkflowError,
  type SecurityRemediationErrorCode,
} from "./types";

export interface ChangeFindingWorkRepositoryInput {
  workspaceId: string;
  findingId: string;
  actorId: string;
  assigneeUserId: string | null;
  remediationNote: string | null;
}

const REMEDIATION_ERROR_CODES = [
  "SECURITY_REMEDIATION_FORBIDDEN",
  "SECURITY_REMEDIATION_ASSIGNEE_INVALID",
  "SECURITY_REMEDIATION_NOTE_INVALID",
  "SECURITY_REMEDIATION_FINDING_NOT_AVAILABLE",
] as const satisfies readonly SecurityRemediationErrorCode[];

function isSecurityFindingWorkRow(value: unknown): value is SecurityFindingWorkRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Partial<SecurityFindingWorkRow>;
  return typeof row.workspace_id === "string"
    && typeof row.finding_id === "string"
    && typeof row.updated_by === "string";
}

function mapTrustedWorkflowError(message: string | undefined): SecurityRemediationWorkflowError | null {
  if (!message) return null;
  for (const code of REMEDIATION_ERROR_CODES) {
    if (message.includes(code)) {
      return new SecurityRemediationWorkflowError(code);
    }
  }
  return null;
}

export function createSecurityRemediationRepository(client: SupabaseClient<Database>) {
  async function loadFinding(
    workspaceId: string,
    findingId: string,
  ): Promise<SecurityFindingRow | null> {
    const { data, error } = await client
      .from("security_findings")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("finding_id", findingId)
      .maybeSingle();

    if (error) throw new Error("Unable to load the security finding.");
    return data;
  }

  async function changeFindingWork(
    input: ChangeFindingWorkRepositoryInput,
  ): Promise<SecurityFindingWorkRow> {
    const { data, error } = await client.rpc("change_security_finding_work", {
      target_workspace_id: input.workspaceId,
      target_finding_id: input.findingId,
      target_actor_id: input.actorId,
      target_assignee_user_id: input.assigneeUserId,
      target_remediation_note: input.remediationNote,
    });

    if (error) {
      const workflowError = mapTrustedWorkflowError(error.message);
      if (workflowError) throw workflowError;
      throw new Error("Unable to change finding remediation work.");
    }

    if (!isSecurityFindingWorkRow(data)) {
      throw new Error("Finding remediation work response was invalid.");
    }
    return data;
  }

  return Object.freeze({
    loadFinding,
    changeFindingWork,
  });
}

export type SecurityRemediationRepository = ReturnType<typeof createSecurityRemediationRepository>;
