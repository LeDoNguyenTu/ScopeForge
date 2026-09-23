import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import CollaboratorControls from "@/components/workspaces/CollaboratorControls";
import { createClient } from "@/lib/supabase/server";
import { getSelectedWorkspaceId } from "@/lib/workspaces/selection";
import { enforcePlatformMaintenanceForUser } from "@/lib/platform-settings/server";
import { enforceAssuranceForRole } from "@/lib/auth/assurance-server";
import { switchWorkspace } from "./actions";
import "./workspace.css";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  await enforcePlatformMaintenanceForUser(user.id, "/dashboard/workspace");
  const [{ data: memberships, error }, selectedId, params] = await Promise.all([
    supabase.from("workspace_members").select("role,workspaces(id,name,slug)").eq("user_id", user.id).order("joined_at", { ascending: true }),
    getSelectedWorkspaceId(user.id), searchParams,
  ]);
  if (error) throw new Error("Unable to load your workspaces.");
  const workspaces = (memberships ?? []).flatMap(membership => {
    const workspace = Array.isArray(membership.workspaces) ? membership.workspaces[0] : membership.workspaces;
    return workspace ? [{ ...workspace, role: membership.role }] : [];
  });
  const active = workspaces.find(workspace => workspace.id === selectedId) ?? workspaces[0];
  if (active) await enforceAssuranceForRole(supabase.auth, active.role, "/dashboard/workspace");
  const canManage = active?.role === "owner" || active?.role === "admin";
  const roster = active && canManage ? await supabase.rpc("list_workspace_collaborators", { target_workspace_id: active.id }) : null;
  return <AppShell displayName={user.user_metadata?.full_name || "ScopeForge user"} workspaceName={active?.name ?? "Your workspaces"} role={active?.role ?? "No membership"}>
    <div className="workspaceSettings">
      <header><h1>Workspace &amp; collaborators</h1><p>Choose where you work and manage who has access.</p></header>
      {params.error === "access" && <p role="alert">That workspace is unavailable. Choose a workspace you belong to.</p>}
      <section className="workspaceSettingsCard"><h2>Your workspaces</h2>
        <form action={switchWorkspace} className="workspaceMemberForm">
          <label>Workspace<select name="workspaceId" defaultValue={active?.id} required>{workspaces.map(workspace => <option value={workspace.id} key={workspace.id}>{workspace.name} — {workspace.role}</option>)}</select></label>
          <button type="submit" className="primaryButton" disabled={!active}>Switch workspace</button>
        </form>
      </section>
      {canManage && active ? roster?.error ? <p role="alert">Collaborator controls are temporarily unavailable. Please try again later.</p> : <CollaboratorControls workspaceId={active.id} members={roster?.data ?? []} />
        : <section className="workspaceSettingsCard"><h2>Collaborator access</h2><p>Only workspace owners and admins can add collaborators or change their access.</p></section>}
    </div>
  </AppShell>;
}
