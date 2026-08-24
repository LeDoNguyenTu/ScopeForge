"use server";

import { revalidatePath } from "next/cache";
import { writeAuditEvent } from "@/lib/audit/write-audit-event";
import type { Database, ScanJobStatus } from "@/lib/database.types";
import { RuntimeAuthorizationError } from "@/lib/runtime-observations/authorization";
import { createRuntimeObservationRepository } from "@/lib/runtime-observations/repository";
import {
  enqueueRuntimeObservation,
  executeRuntimeObservation,
  requestRuntimeObservationCancellation,
  type RuntimeObservationAuditEvent,
  type RuntimeObservationServiceDependencies,
} from "@/lib/runtime-observations/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDashboardContext } from "@/lib/workspaces/current";
import { RUNTIME_OBSERVATION_MAX_BUDGET } from "@/packages/runtime-observer";

type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
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

function createDependencies(): RuntimeObservationServiceDependencies {
  const admin = createAdminClient();
  const repository = createRuntimeObservationRepository(admin);

  async function loadAsset(assetId: string, workspaceId: string): Promise<AssetRow | null> {
    const { data, error } = await admin
      .from("assets")
      .select("*")
      .eq("id", assetId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) throw new Error("Unable to load the runtime observation asset.");
    return data;
  }

  async function audit(event: RuntimeObservationAuditEvent): Promise<void> {
    await writeAuditEvent({
      supabase: admin,
      workspaceId: event.workspaceId,
      eventType: event.eventType,
      actorId: event.actorId,
      targetType: "asset",
      targetId: event.assetId,
      metadata: {
        jobId: event.jobId,
        details: event.metadata,
      },
    });
  }

  return Object.freeze({ repository, loadAsset, audit });
}

export async function runPassiveRuntimeObservation(
  assetId: string,
): Promise<RuntimeObservationActionResult<{ job: RuntimeObservationJobActionSummary }>> {
  try {
    const { user, workspace, role } = await getDashboardContext();
    const dependencies = createDependencies();
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
    const dependencies = createDependencies();
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
