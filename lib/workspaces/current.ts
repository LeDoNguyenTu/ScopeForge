import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getDashboardContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const [{ data: profile }, { data: memberships, error: membershipError }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("workspace_members").select("role, workspaces(id,name,slug)").eq("user_id", user.id).limit(1)
  ]);
  if (membershipError) throw new Error(membershipError.message);

  const membership = memberships?.[0];
  const workspace = Array.isArray(membership?.workspaces) ? membership?.workspaces[0] : membership?.workspaces;
  if (!membership || !workspace) throw new Error("Workspace onboarding is incomplete.");

  return {
    supabase,
    user,
    workspace,
    role: membership.role,
    displayName: profile?.display_name || user.email?.split("@")[0] || "ScopeForge user"
  };
}
