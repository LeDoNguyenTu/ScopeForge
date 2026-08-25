"use server";

import { revalidatePath } from "next/cache";
import type { Database, ScanJobStatus } from "@/lib/database.types";
import { RuntimeAuthorizationError } from "@/lib/runtime-observations/authorization";
import { createRuntimeObservationServerDependencies } from "@/lib/runtime-observations/server-dependencies";
import {
  enqueueRuntimeObservation,
  executeRuntimeObservation,
  requestRuntimeObservationCancellation,
} from "@/lib/runtime-observations/service";
import { getDashboardContext } from "@/lib/workspaces/current";
import { RUNTIME_OBSERVATION_MAX_BUDGET } from "@/packages/runtime-observer";

type ScanJobRow = Database["public"]["Tables"]["scan_jobs"]["Row"];

export type RuntimeObservationActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export interface RuntimeObservationJobActionSummary {
  id: string;
  status: ScanJobStatus;
  blockedReason: string | null;
  failureCode: string | null;
  requestCount: number;
  redirectCount: number;
  findingCount: number;
  cancelRequestedAt: string | null;
}

function summarizeJob(job: ScanJobRow): RuntimeObservationJobActionSummary {
  return {
    id: job.id,
    status: job.status,
    blockedReason: job.blocked_reason,
    failureCode: job.failure_code,
    requestCount: job.request_count,
    redirectCount: job.redirect_count,
    findingCount: job.finding_count,
    cancelRequestedAt: job.cancel_requested_at,
  };
}

function failure(error: unknown): RuntimeObservationActionResult<never> {
  if (error instanceof RuntimeAuthorizationError) {
    return { ok: false, error: { code: error.code, message: error.reason } };
  }
  return {
    ok: false,
    error: {
      code: "RUNTIME_OBSERVATION_REQUEST_FAILED",
      message: "The passive observation request could not be completed safely.",
    },
  };
}

export async function runPassiveRuntimeObservation(
  assetId: string,
): Promise<RuntimeObservationActionResult<{ job: RuntimeObservationJobActionSummary }>> {
  try {
    const { user, workspace, role } = await getDashboardContext();
    const dependencies = createRuntimeObservationServerDependencies();
    const queued = await enqueueRuntimeObservation(
      {
        actorId: user.id,
        workspaceId: workspace.id,
        role,
        assetId,
        budget: RUNTIME_OBSERVATION_MAX_BUDGET,
      },
      dependencies,
    );
    const result = await executeRuntimeObservation(queued.job.id, dependencies);
    const job = result.job ?? queued.job;

    revalidatePath(`/dashboard/assets/${assetId}`);
    return { ok: true, data: { job: summarizeJob(job) } };
  } catch (error) {
    return failure(error);
  }
}

export async function cancelPassiveRuntimeObservation(
  jobId: string,
): Promise<RuntimeObservationActionResult<{ job: RuntimeObservationJobActionSummary; status: string }>> {
  try {
    const { user, workspace, role } = await getDashboardContext();
    const dependencies = createRuntimeObservationServerDependencies();
    const result = await requestRuntimeObservationCancellation(
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
