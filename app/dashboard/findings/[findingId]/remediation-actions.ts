"use server";

import { revalidatePath } from "next/cache";
import { createActiveValidationServerDependencies } from "@/lib/active-validation/server-dependencies";
import type {
  SecurityFindingRetestRow,
  SecurityFindingWorkRow,
} from "@/lib/database.types";
import { createRuntimeObservationServerDependencies } from "@/lib/runtime-observations/server-dependencies";
import { createSecurityRemediationRepository } from "@/lib/security-remediation/repository";
import {
  executeFindingRetest,
  requestFindingRetest,
  SecurityRemediationWorkflowError,
  updateFindingWork,
} from "@/lib/security-remediation/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDashboardContext } from "@/lib/workspaces/current";

export type SecurityRemediationActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

function failure(error: unknown): SecurityRemediationActionResult<never> {
  if (error instanceof SecurityRemediationWorkflowError) {
    return { ok: false, error: { code: error.code, message: error.reason } };
  }
  return {
    ok: false,
    error: {
      code: "SECURITY_REMEDIATION_REQUEST_FAILED",
      message: "The finding remediation request could not be completed safely.",
    },
  };
}

function revalidateFinding(findingId: string): void {
  revalidatePath("/dashboard/findings");
  revalidatePath(`/dashboard/findings/${findingId}`);
}

export async function updateFindingRemediationAction(
  findingId: string,
  assigneeUserId: string | null,
  remediationNote: string | null,
): Promise<SecurityRemediationActionResult<SecurityFindingWorkRow>> {
  try {
    const { user, workspace, role } = await getDashboardContext();
    const repository = createSecurityRemediationRepository(createAdminClient());
    const work = await updateFindingWork({
      actorId: user.id,
      workspaceId: workspace.id,
      role,
      findingId,
      assigneeUserId,
      remediationNote,
    }, { repository });

    revalidateFinding(findingId);
    return { ok: true, data: work };
  } catch (error) {
    return failure(error);
  }
}

export async function runFindingRetestAction(
  findingId: string,
  explicitConsent: boolean,
): Promise<SecurityRemediationActionResult<SecurityFindingRetestRow>> {
  try {
    const { user, workspace, role } = await getDashboardContext();
    const repository = createSecurityRemediationRepository(createAdminClient());
    const retest = await requestFindingRetest({
      actorId: user.id,
      workspaceId: workspace.id,
      role,
      findingId,
      explicitConsent,
    }, { repository });

    const completed = await executeFindingRetest({
      actorId: user.id,
      workspaceId: workspace.id,
      role,
      retest,
    }, {
      repository,
      runtimeDependencies: createRuntimeObservationServerDependencies(),
      activeDependencies: createActiveValidationServerDependencies(),
    });

    revalidateFinding(findingId);
    return { ok: true, data: completed };
  } catch (error) {
    return failure(error);
  }
}
