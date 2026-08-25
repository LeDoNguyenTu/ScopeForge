import type { SecurityFindingRetestRow } from "@/lib/database.types";
import { SecurityRemediationWorkflowError } from "./types";

type RecoveryRpcError = { message?: string } | null;

type RecoveryRpcClient = {
  rpc(
    name: "abort_security_finding_retest_before_start",
    args: {
      target_workspace_id: string;
      target_retest_id: string;
      target_actor_id: string;
    },
  ): PromiseLike<{ data: unknown; error: RecoveryRpcError }>;
};

function isSecurityFindingRetestRow(value: unknown): value is SecurityFindingRetestRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Partial<SecurityFindingRetestRow>;
  return typeof row.id === "string"
    && typeof row.workspace_id === "string"
    && typeof row.finding_id === "string"
    && (row.execution_kind === "passive_runtime" || row.execution_kind === "active_validation")
    && row.status === "failed"
    && row.result_code === "enqueue_failed";
}

function mapAbortError(error: RecoveryRpcError): SecurityRemediationWorkflowError | null {
  const message = error?.message ?? "";
  for (const code of [
    "SECURITY_RETEST_FORBIDDEN",
    "SECURITY_RETEST_NOT_AVAILABLE",
    "SECURITY_RETEST_FINALIZATION_INVALID",
  ] as const) {
    if (message.includes(code)) return new SecurityRemediationWorkflowError(code);
  }
  return null;
}

export function createSecurityRetestRecoveryRepository(client: unknown) {
  const rpcClient = client as RecoveryRpcClient;

  async function abortRetestBeforeStart(input: {
    workspaceId: string;
    retestId: string;
    actorId: string;
  }): Promise<SecurityFindingRetestRow> {
    const { data, error } = await rpcClient.rpc("abort_security_finding_retest_before_start", {
      target_workspace_id: input.workspaceId,
      target_retest_id: input.retestId,
      target_actor_id: input.actorId,
    });

    if (error) {
      const workflowError = mapAbortError(error);
      if (workflowError) throw workflowError;
      throw new Error("Unable to recover the unstarted finding retest.");
    }

    if (!isSecurityFindingRetestRow(data)) {
      throw new Error("Finding retest recovery response was invalid.");
    }

    return data;
  }

  return Object.freeze({ abortRetestBeforeStart });
}

export type SecurityRetestRecoveryRepository = ReturnType<typeof createSecurityRetestRecoveryRepository>;
