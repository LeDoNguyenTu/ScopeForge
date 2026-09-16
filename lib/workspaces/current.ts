import { redirect } from "next/navigation";
import { enforcePlatformMaintenanceForUser } from "@/lib/platform-settings/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedWorkspaceId } from "@/lib/workspaces/selection";

export async function getDashboardContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  await enforcePlatformMaintenanceForUser(user.id, "/dashboard");

  const selectedId = await getSelectedWorkspaceId(user.id);
  let membershipQuery = supabase.from("workspace_members").select("role, workspaces(id,name,slug)").eq("user_id", user.id);
  if (selectedId) membershipQuery = membershipQuery.eq("workspace_id", selectedId);
  const [{ data: profile }, { data: memberships, error: membershipError }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    membershipQuery.order("joined_at", { ascending: true }).limit(1)
  ]);
  if (membershipError) throw new Error(membershipError.message);

  const membership = memberships?.[0];
  const workspace = Array.isArray(membership?.workspaces) ? membership?.workspaces[0] : membership?.workspaces;
  if (!membership || !workspace) redirect("/dashboard/workspace?error=access");

  return {
    supabase,
    user,
    workspace,
    role: membership.role,
    displayName: profile?.display_name || user.email?.split("@")[0] || "ScopeForge user"
  };
}
