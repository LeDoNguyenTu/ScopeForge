import type { SecurityFindingRetestRow, WorkspaceRole } from "@/lib/database.types";
import { SecurityRemediationWorkflowError } from "./types";

export interface FindingRetestRecoveryExecutionInput {
  actorId: string;
  workspaceId: string;
  role: WorkspaceRole;
  retest: SecurityFindingRetestRow;
}

export interface FindingRetestRecoveryDependencies {
  execute(input: FindingRetestRecoveryExecutionInput): Promise<SecurityFindingRetestRow>;
  abortRetestBeforeStart(input: {
    workspaceId: string;
    retestId: string;
    actorId: string;
  }): Promise<SecurityFindingRetestRow>;
}

export async function executeFindingRetestWithRecovery(
  input: FindingRetestRecoveryExecutionInput,
  dependencies: FindingRetestRecoveryDependencies,
): Promise<SecurityFindingRetestRow> {
  try {
    return await dependencies.execute(input);
  } catch {
    try {
      await dependencies.abortRetestBeforeStart({
        workspaceId: input.workspaceId,
        retestId: input.retest.id,
        actorId: input.actorId,
      });
    } catch {
      // The abort transaction is intentionally best-effort here. It only succeeds
      // while the retest is still unstarted; running retests remain owned by the
      // authoritative runtime job/finalization path.
    }

    throw new SecurityRemediationWorkflowError("SECURITY_RETEST_EXECUTION_FAILED");
  }
}
