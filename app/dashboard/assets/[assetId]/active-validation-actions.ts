"use server";

import { revalidatePath } from "next/cache";
import { writeAuditEvent } from "@/lib/audit/write-audit-event";
import type { Database, ScanJobStatus } from "@/lib/database.types";
import { ActiveValidationAuthorizationError } from "@/lib/active-validation/authorization";
import { createActiveValidationRepository } from "@/lib/active-validation/repository";
import {
  enqueueActiveValidation,
  executeActiveValidation,
  requestActiveValidationCancellation,
  type ActiveValidationAuditEvent,
  type ActiveValidationServiceDependencies,
} from "@/lib/active-validation/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDashboardContext } from "@/lib/workspaces/current";
import { ACTIVE_VALIDATION_MAX_BUDGET } from "@/packages/runtime-validator";

type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
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

function createDependencies(): ActiveValidationServiceDependencies {
  const admin = createAdminClient();
  const repository = createActiveValidationRepository(admin);

  async function loadAsset(assetId: string, workspaceId: string): Promise<AssetRow | null> {
    const { data, error } = await admin
      .from("assets")
      .select("*")
      .eq("id", assetId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) throw new Error("Unable to load the active validation asset.");
    return data;
  }

  async function audit(event: ActiveValidationAuditEvent): Promise<void> {
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

export async function runCorsOriginPolicyValidation(
  assetId: string,
  explicitConsent: boolean,
): Promise<ActiveValidationActionResult<{ job: ActiveValidationJobActionSummary }>> {
  try {
    const { user, workspace, role } = await getDashboardContext();
    const dependencies = createDependencies();
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
    const dependencies = createDependencies();
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
