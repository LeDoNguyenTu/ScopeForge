import AppShell from "@/components/AppShell";
import ResourceLibrary from "@/components/ResourceLibrary";
import { getDashboardContext } from "@/lib/workspaces/current";

export const dynamic = "force-dynamic";
export const metadata = { title: "Workspace resources" };

export default async function WorkspaceResourcesPage() {
  const { workspace, role, displayName } = await getDashboardContext();
  return <AppShell displayName={displayName} workspaceName={workspace.name} role={role}><ResourceLibrary workspace /></AppShell>;
}
