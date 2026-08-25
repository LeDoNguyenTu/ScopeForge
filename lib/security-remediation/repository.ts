import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  SecurityFindingRetestRow,
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

export interface RequestFindingRetestRepositoryInput {
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
}

export interface MarkRetestRunningRepositoryInput {
  workspaceId: string;
  retestId: string;
  scanJobId: string;
  actorId: string;
}

export interface FinalizeRetestRepositoryInput {
  workspaceId: string;
  retestId: string;
}

const WORKFLOW_ERROR_CODES = [
  "SECURITY_REMEDIATION_FORBIDDEN",
  "SECURITY_REMEDIATION_ASSIGNEE_INVALID",
  "SECURITY_REMEDIATION_NOTE_INVALID",
  "SECURITY_REMEDIATION_FINDING_NOT_AVAILABLE",
  "SECURITY_RETEST_UNSUPPORTED_SOURCE",
  "SECURITY_RETEST_CONSENT_REQUIRED",
  "SECURITY_RETEST_FORBIDDEN",
  "SECURITY_RETEST_STATE_INVALID",
  "SECURITY_RETEST_ACTIVE_CONFLICT",
  "SECURITY_RETEST_NOT_AVAILABLE",
  "SECURITY_RETEST_JOB_INVALID",
  "SECURITY_RETEST_FINALIZATION_INVALID",
] as const satisfies readonly SecurityRemediationErrorCode[];

const RETEST_STATUSES = new Set<SecurityFindingRetestRow["status"]>([
  "requested",
  "running",
  "still_present",
  "verified_fixed",
  "inconclusive",
  "failed",
  "cancelled",
]);

function isSecurityFindingWorkRow(value: unknown): value is SecurityFindingWorkRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Partial<SecurityFindingWorkRow>;
  return typeof row.workspace_id === "string"
    && typeof row.finding_id === "string"
    && typeof row.updated_by === "string";
}

function isSecurityFindingRetestRow(value: unknown): value is SecurityFindingRetestRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Partial<SecurityFindingRetestRow>;
  return typeof row.id === "string"
    && typeof row.workspace_id === "string"
    && typeof row.finding_id === "string"
    && (row.execution_kind === "passive_runtime" || row.execution_kind === "active_validation")
    && typeof row.status === "string"
    && RETEST_STATUSES.has(row.status as SecurityFindingRetestRow["status"]);
}

function mapTrustedWorkflowError(message: string | undefined): SecurityRemediationWorkflowError | null {
  if (!message) return null;
  for (const code of WORKFLOW_ERROR_CODES) {
    if (message.includes(code)) {
      return new SecurityRemediationWorkflowError(code);
    }
  }
  return null;
}

function throwRepositoryError(
  error: { message?: string } | null,
  fallback: string,
): never {
  const workflowError = mapTrustedWorkflowError(error?.message);
  if (workflowError) throw workflowError;
  throw new Error(fallback);
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
      throwRepositoryError(error, "Unable to change finding remediation work.");
    }
    if (!isSecurityFindingWorkRow(data)) {
      throw new Error("Finding remediation work response was invalid.");
    }
    return data;
  }

  async function requestFindingRetest(
    input: RequestFindingRetestRepositoryInput,
  ): Promise<SecurityFindingRetestRow> {
    const { data, error } = await client.rpc("request_security_finding_retest", {
      target_workspace_id: input.workspaceId,
      target_finding_id: input.findingId,
      target_actor_id: input.actorId,
      target_execution_kind: input.executionKind,
      target_source_id: input.sourceId,
      target_source_version: input.sourceVersion,
      target_rule_ref: input.ruleRef,
      target_validation_profile_id: input.validationProfileId,
      target_validation_profile_version: input.validationProfileVersion,
      target_explicit_consent: input.explicitConsent,
    });

    if (error) {
      throwRepositoryError(error, "Unable to request the finding retest.");
    }
    if (!isSecurityFindingRetestRow(data) || data.status !== "requested") {
      throw new Error("Finding retest response was invalid.");
    }
    return data;
  }

  async function markRetestRunning(
    input: MarkRetestRunningRepositoryInput,
  ): Promise<SecurityFindingRetestRow> {
    const { data, error } = await client.rpc("mark_security_finding_retest_running", {
      target_workspace_id: input.workspaceId,
      target_retest_id: input.retestId,
      target_scan_job_id: input.scanJobId,
      target_actor_id: input.actorId,
    });

    if (error) {
      throwRepositoryError(error, "Unable to attach the retest job.");
    }
    if (!isSecurityFindingRetestRow(data) || data.status !== "running") {
      throw new Error("Finding retest running response was invalid.");
    }
    return data;
  }

  async function finalizeRetest(
    input: FinalizeRetestRepositoryInput,
  ): Promise<SecurityFindingRetestRow> {
    const { data, error } = await client.rpc("finalize_security_finding_retest", {
      target_workspace_id: input.workspaceId,
      target_retest_id: input.retestId,
    });

    if (error) {
      throwRepositoryError(error, "Unable to finalize the finding retest.");
    }
    if (!isSecurityFindingRetestRow(data) || data.status === "requested" || data.status === "running") {
      throw new Error("Finding retest finalization response was invalid.");
    }
    return data;
  }

  return Object.freeze({
    loadFinding,
    changeFindingWork,
    requestFindingRetest,
    markRetestRunning,
    finalizeRetest,
  });
}

export type SecurityRemediationRepository = ReturnType<typeof createSecurityRemediationRepository>;
