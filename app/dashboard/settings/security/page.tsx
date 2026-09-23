import AppShell from "@/components/AppShell";
import AccountSecurityPanel from "@/components/auth/AccountSecurityPanel";
import { getDashboardContext } from "@/lib/workspaces/current";

export const dynamic = "force-dynamic";

export default async function AccountSecurityPage() {
  const { user, workspace, role, displayName } = await getDashboardContext({ enforceMfa: false });
  return (
    <AppShell displayName={displayName} role={role} workspaceName={workspace.name}>
      <AccountSecurityPanel email={user.email ?? "Email unavailable"} />
    </AppShell>
  );
}
