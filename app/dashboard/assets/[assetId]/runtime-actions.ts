"use server";

import { revalidatePath } from "next/cache";
import type { Database, ScanJobStatus } from "@/lib/database.types";
import { RuntimeAuthorizationError } from "@/lib/runtime-observations/authorization";
import { createRuntimeObservationServerDependencies } from "@/lib/runtime-observations/server-dependencies";
import { requestRuntimeObservationCancellation } from "@/lib/runtime-observations/service";
import { RuntimeWorkerError } from "@/lib/runtime-workers/errors";
import { requestPassiveRuntimeWorker } from "@/lib/runtime-workers/request";
import { createRuntimeWorkerRequestServerDependencies } from "@/lib/runtime-workers/request-server-dependencies";
import { getDashboardContext } from "@/lib/workspaces/current";

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
  if (error instanceof RuntimeWorkerError) {
    const message = error.code === "RUNTIME_WORKER_UNAVAILABLE"
      ? "Hosted passive observation workers are not available yet."
      : error.code === "RUNTIME_WORKER_BUSY"
        ? "Another runtime network task is already active for this workspace."
        : "The passive observation could not be queued safely.";
    return { ok: false, error: { code: error.code, message } };
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
    const result = await requestPassiveRuntimeWorker(
      {
        actorId: user.id,
        workspaceId: workspace.id,
        role,
        assetId,
      },
      createRuntimeWorkerRequestServerDependencies(),
    );

    revalidatePath(`/dashboard/assets/${assetId}`);
    return { ok: true, data: { job: summarizeJob(result.job) } };
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
