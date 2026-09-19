"use server";

import { revalidatePath } from "next/cache";
import { PlatformAdminAuthorizationError } from "@/lib/platform-admin/authorization";
import {
  launchPhase11HttpCanary,
  Phase11CanaryError,
} from "@/lib/platform-admin/phase11-operations";

export type Phase11CanaryActionResult =
  | { ok: true; message: string; runId: string; actionId: string }
  | { ok: false; error: { code: string; message: string } };

export async function launchPhase11CanaryAction(
  _previousState: Phase11CanaryActionResult | null,
  formData: FormData,
): Promise<Phase11CanaryActionResult> {
  try {
    const result = await launchPhase11HttpCanary({
      assetId: String(formData.get("assetId") ?? ""),
    });
    revalidatePath("/admin");
    revalidatePath("/admin/phase11");
    return {
      ok: true,
      message: "The bounded Phase 11 HTTP canary was queued.",
      runId: result.runId,
      actionId: result.queuedActionIds[0],
    };
  } catch (error) {
    if (error instanceof Phase11CanaryError || error instanceof PlatformAdminAuthorizationError) {
      return { ok: false, error: { code: error.code, message: error.message } };
    }
    return {
      ok: false,
      error: {
        code: "PHASE11_CANARY_FAILED",
        message: "The bounded Phase 11 canary could not be queued safely.",
      },
    };
  }
}
