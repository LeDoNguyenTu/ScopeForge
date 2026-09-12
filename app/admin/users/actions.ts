"use server";

import { revalidatePath } from "next/cache";
import { PlatformAdminAuthorizationError } from "@/lib/platform-admin/authorization";
import {
  PlatformAdminUserActionError,
  hardDeletePlatformUser,
  restorePlatformUser,
  suspendPlatformUser,
} from "@/lib/platform-admin/user-actions";

export type PlatformAdminActionResult =
  | { ok: true; message: string }
  | { ok: false; error: { code: string; message: string } };

function failure(error: unknown): PlatformAdminActionResult {
  if (error instanceof PlatformAdminUserActionError || error instanceof PlatformAdminAuthorizationError) {
    return { ok: false, error: { code: error.code, message: error.message } };
  }
  return {
    ok: false,
    error: {
      code: "PLATFORM_ADMIN_USER_ACTION_FAILED",
      message: "The platform user action could not be completed safely.",
    },
  };
}

function revalidateUserPages(userId: string): void {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  if (userId) revalidatePath(`/admin/users/${userId}`);
}

export async function suspendUserAction(
  _previousState: PlatformAdminActionResult | null,
  formData: FormData,
): Promise<PlatformAdminActionResult> {
  const userId = String(formData.get("userId") ?? "");
  try {
    await suspendPlatformUser({
      userId,
      reason: String(formData.get("reason") ?? ""),
    });
    revalidateUserPages(userId);
    return { ok: true, message: "User suspended. Existing access tokens may remain valid until they expire." };
  } catch (error) {
    return failure(error);
  }
}

export async function restoreUserAction(
  _previousState: PlatformAdminActionResult | null,
  formData: FormData,
): Promise<PlatformAdminActionResult> {
  const userId = String(formData.get("userId") ?? "");
  try {
    await restorePlatformUser({
      userId,
      reason: String(formData.get("reason") ?? ""),
    });
    revalidateUserPages(userId);
    return { ok: true, message: "User access restored." };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteUserAction(
  _previousState: PlatformAdminActionResult | null,
  formData: FormData,
): Promise<PlatformAdminActionResult> {
  const userId = String(formData.get("userId") ?? "");
  try {
    await hardDeletePlatformUser({
      userId,
      emailConfirmation: String(formData.get("emailConfirmation") ?? ""),
      reason: String(formData.get("reason") ?? ""),
    });
    revalidatePath("/admin");
    revalidatePath("/admin/users");
    revalidatePath("/admin/workspaces");
    return { ok: true, message: "User and eligible personal workspace data were deleted." };
  } catch (error) {
    return failure(error);
  }
}
