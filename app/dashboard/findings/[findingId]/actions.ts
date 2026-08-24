"use server";

import { revalidatePath } from "next/cache";
import { createSecurityFindingRepository } from "@/lib/security-findings/repository";
import {
  changeFindingLifecycle,
  FindingLifecycleWorkflowError,
  type FindingLifecycleServiceDependencies,
  type Phase5ALifecycleAction,
} from "@/lib/security-findings/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDashboardContext } from "@/lib/workspaces/current";

export type FindingLifecycleActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export interface FindingLifecycleActionSummary {
  findingId: string;
  lifecycleState: string;
  updatedAt: string;
}

function failure(error: unknown): FindingLifecycleActionResult<never> {
  if (error instanceof FindingLifecycleWorkflowError) {
    return { ok: false, error: { code: error.code, message: error.reason } };
  }
  return {
    ok: false,
    error: {
      code: "FINDING_LIFECYCLE_UPDATE_FAILED",
      message: "The finding lifecycle could not be changed safely.",
    },
  };
}

function createDependencies(): FindingLifecycleServiceDependencies {
  const admin = createAdminClient();
  return Object.freeze({ repository: createSecurityFindingRepository(admin) });
}

export async function changeFindingLifecycleAction(
  findingId: string,
  action: Phase5ALifecycleAction,
  note?: string,
): Promise<FindingLifecycleActionResult<FindingLifecycleActionSummary>> {
  try {
    const { user, workspace, role } = await getDashboardContext();
    const finding = await changeFindingLifecycle({
      actorId: user.id,
      workspaceId: workspace.id,
      role,
      findingId,
      action,
      note,
    }, createDependencies());

    revalidatePath("/dashboard/findings");
    revalidatePath(`/dashboard/findings/${findingId}`);
    return {
      ok: true,
      data: {
        findingId: finding.finding_id,
        lifecycleState: finding.lifecycle_state,
        updatedAt: finding.updated_at,
      },
    };
  } catch (error) {
    return failure(error);
  }
}
