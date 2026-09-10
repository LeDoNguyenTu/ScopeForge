import AppShell from "@/components/AppShell";
import ResourceLibrary from "@/components/ResourceLibrary";
import { demoIdentity } from "@/lib/demo/fixtures";

export const dynamic = "force-dynamic";
export const metadata = { title: "Workspace resources" };

export default async function WorkspaceResourcesPage() {
  const { workspaceName, role, displayName } = demoIdentity;
  const workspace = { name: workspaceName };
  return <AppShell displayName={displayName} workspaceName={workspace.name} role={role}><ResourceLibrary workspace /></AppShell>;
}
