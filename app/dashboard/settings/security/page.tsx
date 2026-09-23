import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import AccountSecurityPanel from "@/components/auth/AccountSecurityPanel";
import RestrictedSecurityShell from "@/components/auth/RestrictedSecurityShell";
import { assuranceDestination, readAssuranceState } from "@/lib/auth/assurance";
import { getDashboardContext } from "@/lib/workspaces/current";

export const dynamic = "force-dynamic";

export default async function AccountSecurityPage() {
  const { supabase, user, workspace, role, displayName } = await getDashboardContext({ enforceMfa: false });
  const destination = assuranceDestination(
    role,
    await readAssuranceState(supabase.auth),
    "/dashboard/settings/security",
  );
  if (destination?.startsWith("/auth/mfa")) redirect(destination);

  const panel = <AccountSecurityPanel email={user.email ?? "Email unavailable"} />;
  if (destination === "/dashboard/settings/security?required=mfa") {
    return <RestrictedSecurityShell>{panel}</RestrictedSecurityShell>;
  }
  return (
    <AppShell displayName={displayName} role={role} workspaceName={workspace.name}>
      {panel}
    </AppShell>
  );
}
