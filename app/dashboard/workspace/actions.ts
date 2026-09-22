"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { WORKSPACE_COOKIE } from "@/lib/workspaces/selection";
import { enforcePlatformMaintenanceForUser } from "@/lib/platform-settings/server";

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export async function switchWorkspace(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  const workspaceId = String(form.get("workspaceId") ?? "");
  if (!UUID.test(workspaceId)) redirect("/dashboard/workspace?error=access");
  const { data, error } = await supabase.from("workspace_members").select("workspace_id")
    .eq("user_id", user.id).eq("workspace_id", workspaceId).maybeSingle();
  if (error || !data) redirect("/dashboard/workspace?error=access");
  (await cookies()).set(WORKSPACE_COOKIE, `${user.id}:${workspaceId}`, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}

export type ManageCollaboratorResult =
  | { ok: false; message: string }
  | {
      ok: true;
      message: string;
      operation: "add" | "role" | "remove";
      collaboratorId?: string;
      role?: "member" | "viewer";
    };

export async function manageCollaborator(form: FormData): Promise<ManageCollaboratorResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in to manage collaborators." };
  await enforcePlatformMaintenanceForUser(user.id, "/dashboard/workspace");
  const workspaceId = String(form.get("workspaceId") ?? "");
  const operation = String(form.get("operation") ?? "");
  const email = String(form.get("email") ?? "").trim();
  const collaboratorId = String(form.get("collaboratorId") ?? "");
  const role = String(form.get("role") ?? "member");
  if (!UUID.test(workspaceId) || !["add", "role", "remove"].includes(operation)
      || !["member", "viewer"].includes(role)
      || (operation === "add" ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 : !UUID.test(collaboratorId))) {
    return { ok: false, message: "Check the email address and workspace role." };
  }
  // The session-scoped RPC reauthorizes and locks membership in the same transaction as the write.
  const { error } = await supabase.rpc("manage_workspace_collaborator", {
    target_workspace_id: workspaceId, operation, collaborator_role: role as "member" | "viewer",
    ...(operation === "add" ? { collaborator_email: email } : { collaborator_id: collaboratorId }),
  });
  if (error) {
    const messages: Record<string, string> = {
      WORKSPACE_FORBIDDEN: "Only workspace owners and admins can manage collaborators.",
      WORKSPACE_ACCOUNT_UNAVAILABLE: "No eligible confirmed account was found. Ask your collaborator to sign up and confirm their email first.",
      WORKSPACE_ALREADY_MEMBER: "This account already belongs to the workspace.",
      WORKSPACE_PROTECTED_MEMBER: "Owner and admin memberships cannot be changed here.",
      WORKSPACE_MEMBER_MISSING: "This collaborator is no longer in the workspace. Refresh and try again.",
    };
    return { ok: false, message: messages[error.message] ?? "The change could not be saved. Please try again." };
  }
  revalidatePath("/dashboard/workspace");
  const normalizedOperation = operation as "add" | "role" | "remove";
  return {
    ok: true,
    message: operation === "add" ? "Collaborator added." : operation === "remove" ? "Collaborator removed." : "Role updated.",
    operation: normalizedOperation,
    ...(operation === "add" ? {} : { collaboratorId }),
    ...(operation === "role" ? { role: role as "member" | "viewer" } : {}),
  };
}
