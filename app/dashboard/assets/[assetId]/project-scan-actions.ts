"use server";

import { revalidatePath } from "next/cache";
import {
  ProjectScanError,
  requestConnectedProjectScan,
} from "@/lib/project-scans/service";
import { getDashboardContext } from "@/lib/workspaces/current";

export type ConnectedProjectScanActionResult =
  | { ok: true; status: "snapshot_queued"; taskId: string; message: string }
  | { ok: true; status: "private_acquisition_required" | "snapshot_runtime_unavailable"; message: string }
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

export async function requestConnectedProjectSecurityScan(
  assetId: string,
): Promise<ConnectedProjectScanActionResult> {
  if (!UUID_PATTERN.test(assetId)) {
    return {
      ok: false,
      error: { code: "PROJECT_SCAN_INPUT_INVALID", message: "The selected connected project is invalid." },
    };
  }

  try {
    const { user, workspace, role } = await getDashboardContext();
    if (role !== "owner" && role !== "admin") {
      return {
        ok: false,
        error: { code: "PROJECT_SCAN_NOT_CONNECTED", message: "Workspace owner or admin access is required." },
      };
    }

    const result = await requestConnectedProjectScan({
      workspaceId: workspace.id,
      assetId,
      actorId: user.id,
    });

    if (result.status === "private_acquisition_required") {
      return {
        ok: true,
        status: "private_acquisition_required",
        message: "This private repository is connected, but private source acquisition ships in Phase 10A2.",
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
