"use server";

import { revalidatePath } from "next/cache";
import { PlatformAdminAuthorizationError } from "@/lib/platform-admin/authorization";
import {
  PlatformSettingsError,
  updatePlatformSettings,
} from "@/lib/platform-settings/server";
import type { PlatformAdminActionResult } from "@/app/admin/users/actions";

function checked(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}

function failure(error: unknown): PlatformAdminActionResult {
  if (error instanceof PlatformSettingsError || error instanceof PlatformAdminAuthorizationError) {
    return { ok: false, error: { code: error.code, message: error.message } };
  }
  return {
    ok: false,
    error: {
      code: "PLATFORM_SETTINGS_UPDATE_FAILED",
      message: "The platform settings could not be updated safely.",
    },
  };
}

export async function updatePlatformSettingsAction(
  _previousState: PlatformAdminActionResult | null,
  formData: FormData,
): Promise<PlatformAdminActionResult> {
  try {
    await updatePlatformSettings({
      registrationEnabled: checked(formData, "registrationEnabled"),
      maintenanceMode: checked(formData, "maintenanceMode"),
      maintenanceMessage: String(formData.get("maintenanceMessage") ?? ""),
      reason: String(formData.get("reason") ?? ""),
    });
    revalidatePath("/");
    revalidatePath("/maintenance");
    revalidatePath("/auth/sign-up");
    revalidatePath("/admin");
    revalidatePath("/admin/settings");
    return { ok: true, message: "Platform settings updated." };
  } catch (error) {
    return failure(error);
  }
}
