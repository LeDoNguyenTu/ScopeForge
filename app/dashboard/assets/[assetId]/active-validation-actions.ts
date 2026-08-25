"use server";

import { revalidatePath } from "next/cache";
import type { Database, ScanJobStatus } from "@/lib/database.types";
import { ActiveValidationAuthorizationError } from "@/lib/active-validation/authorization";
import { createActiveValidationServerDependencies } from "@/lib/active-validation/server-dependencies";
import {
  enqueueActiveValidation,
  executeActiveValidation,
  requestActiveValidationCancellation,
} from "@/lib/active-validation/service";
import { getDashboardContext } from "@/lib/workspaces/current";
import { ACTIVE_VALIDATION_MAX_BUDGET } from "@/packages/runtime-validator";

type ScanJobRow = Database["public"]["Tables"]["scan_jobs"]["Row"];

export type ActiveValidationActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export interface ActiveValidationJobActionSummary {
  id: string;
  status: ScanJobStatus;
  blockedReason: string | null;
  failureCode: string | null;
  requestCount: number;
  findingCount: number;
  cancelRequestedAt: string | null;
}

function summarizeJob(job: ScanJobRow): ActiveValidationJobActionSummary {
  return {
    id: job.id,
    status: job.status,
    blockedReason: job.blocked_reason,
    failureCode: job.failure_code,
    requestCount: job.request_count,
    findingCount: job.finding_count,
    cancelRequestedAt: job.cancel_requested_at,
  };
}

function failure(error: unknown): ActiveValidationActionResult<never> {
  if (error instanceof ActiveValidationAuthorizationError) {
    return { ok: false, error: { code: error.code, message: error.reason } };
  }
  return {
    ok: false,
    error: {
      code: "ACTIVE_VALIDATION_REQUEST_FAILED",
      message: "The bounded active validation request could not be completed safely.",
    },
  };
}

export async function runCorsOriginPolicyValidation(
  assetId: string,
  explicitConsent: boolean,
): Promise<ActiveValidationActionResult<{ job: ActiveValidationJobActionSummary }>> {
  try {
    const { user, workspace, role } = await getDashboardContext();
    const dependencies = createActiveValidationServerDependencies();
    const queued = await enqueueActiveValidation(
      {
        actorId: user.id,
        workspaceId: workspace.id,
        role,
        assetId,
        explicitConsent,
        budget: ACTIVE_VALIDATION_MAX_BUDGET,
      },
      dependencies,
    );
    const result = await executeActiveValidation(queued.job.id, dependencies);
    const job = result.job ?? queued.job;

    revalidatePath(`/dashboard/assets/${assetId}`);
    return { ok: true, data: { job: summarizeJob(job) } };
  } catch (error) {
    return failure(error);
  }
}

export async function cancelActiveValidation(
  jobId: string,
): Promise<ActiveValidationActionResult<{ job: ActiveValidationJobActionSummary; status: string }>> {
  try {
    const { user, workspace, role } = await getDashboardContext();
    const dependencies = createActiveValidationServerDependencies();
    const result = await requestActiveValidationCancellation(
      {
        actorId: user.id,
        workspaceId: workspace.id,
        role,
        jobId,
      },
      dependencies,
    );

    revalidatePath(`/dashboard/assets/${result.job.asset_id}`);
    return {
      ok: true,
      data: {
        job: summarizeJob(result.job),
        status: result.status,
      },
    };
  } catch (error) {
    return failure(error);
  }
}
