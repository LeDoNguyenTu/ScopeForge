"use server";

import { revalidatePath } from "next/cache";
import {
  ProjectScanError,
  requestConnectedProjectScan,
  resumeConnectedProjectScan,
} from "@/lib/project-scans/service";
import { getDashboardContext } from "@/lib/workspaces/current";

export type ConnectedProjectScanActionResult =
  | { ok: true; status: "snapshot_queued"; taskId: string; message: string }
  | { ok: true; status: "private_snapshot_runtime_unavailable" | "snapshot_runtime_unavailable"; message: string }
  | { ok: true; status: "scan_queued"; taskId: string; scanJobId: string; replayed: boolean; message: string }
  | { ok: true; status: "retry_pending" | "scan_runtime_unavailable" | "no_pending_scan"; message: string }
  | { ok: false; error: { code: string; message: string } };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeFailure(error: unknown): ConnectedProjectScanActionResult {
  if (error instanceof ProjectScanError) {
    const messages: Record<string, string> = {
      PROJECT_SCAN_INPUT_INVALID: "The selected connected project is invalid.",
      PROJECT_SCAN_NOT_CONNECTED: "Connect this repository to GitHub before starting a project scan.",
      PROJECT_SCAN_ACCESS_INACTIVE: "GitHub access for this repository is no longer active.",
      PROJECT_SCAN_PROVIDER_FAILED: "GitHub repository access could not be verified safely.",
      PROJECT_SCAN_REPOSITORY_MISMATCH: "The GitHub repository no longer matches the registered ScopeForge project.",
      PROJECT_SCAN_PERSIST_FAILED: "The connected project scan could not be queued safely.",
    };
    return {
      ok: false,
      error: {
        code: error.code,
        message: messages[error.code] ?? "The connected project scan could not be started safely.",
      },
    };
  }
  return {
    ok: false,
    error: {
      code: "PROJECT_SCAN_REQUEST_FAILED",
      message: "The connected project scan could not be started safely.",
    },
  };
}

function invalidAssetResult(): ConnectedProjectScanActionResult {
  return {
    ok: false,
    error: { code: "PROJECT_SCAN_INPUT_INVALID", message: "The selected connected project is invalid." },
  };
}

async function getManageableProjectContext() {
  const context = await getDashboardContext();
  if (context.role !== "owner" && context.role !== "admin") {
    throw new ProjectScanError("PROJECT_SCAN_NOT_CONNECTED", "Workspace owner or admin access is required.");
  }
  return context;
}

export async function requestConnectedProjectSecurityScan(
  assetId: string,
): Promise<ConnectedProjectScanActionResult> {
  if (!UUID_PATTERN.test(assetId)) return invalidAssetResult();

  try {
    const { user, workspace } = await getManageableProjectContext();
    const result = await requestConnectedProjectScan({
      workspaceId: workspace.id,
      assetId,
      actorId: user.id,
    });

    if (result.status === "private_snapshot_runtime_unavailable") {
      return {
        ok: true,
        status: "private_snapshot_runtime_unavailable",
        message: "This private repository is connected and authorized, but the dedicated private snapshot runtime is disabled in this deployment.",
      };
    }
    if (result.status === "snapshot_runtime_unavailable") {
      return {
        ok: true,
        status: "snapshot_runtime_unavailable",
        message: "The project is ready, but hosted source acquisition remains gated until runtime acceptance passes.",
      };
    }

    revalidatePath(`/dashboard/assets/${assetId}`);
    return {
      ok: true,
      status: "snapshot_queued",
      taskId: result.taskId,
      message: "ScopeForge queued an immutable source snapshot. The repository scan will continue automatically after publication when its runtime gate is enabled.",
    };
  } catch (error) {
    return safeFailure(error);
  }
}

export async function resumeConnectedProjectSecurityScan(
  assetId: string,
): Promise<ConnectedProjectScanActionResult> {
  if (!UUID_PATTERN.test(assetId)) return invalidAssetResult();

  try {
    const { user, workspace } = await getManageableProjectContext();
    const result = await resumeConnectedProjectScan({
      workspaceId: workspace.id,
      assetId,
      actorId: user.id,
    });

    if (result.status === "scan_runtime_unavailable") {
      return {
        ok: true,
        status: "scan_runtime_unavailable",
        message: "The published source snapshot is retained, but the repository scan runtime is still gated.",
      };
    }
    if (result.status === "no_pending_scan") {
      return {
        ok: true,
        status: "no_pending_scan",
        message: "No published connected-project scan is waiting for recovery.",
      };
    }
    if (result.status === "retry_pending") {
      revalidatePath(`/dashboard/assets/${assetId}`);
      return {
        ok: true,
        status: "retry_pending",
        message: "The published snapshot is still valid, but the scan continuation remains pending a safe retry.",
      };
    }

    revalidatePath(`/dashboard/assets/${assetId}`);
    return {
      ok: true,
      status: "scan_queued",
      taskId: result.taskId,
      scanJobId: result.scanJobId,
      replayed: result.replayed,
      message: result.replayed
        ? "The repository scan was already queued for this published snapshot."
        : "ScopeForge resumed the published snapshot and queued its repository scan.",
    };
  } catch (error) {
    return safeFailure(error);
  }
}
