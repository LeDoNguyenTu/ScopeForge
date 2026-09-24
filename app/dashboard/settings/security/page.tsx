import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import AccountSecurityPanel from "@/components/auth/AccountSecurityPanel";
import RestrictedSecurityShell from "@/components/auth/RestrictedSecurityShell";
import { assuranceDestination, readAssuranceState } from "@/lib/auth/assurance";
import { getDashboardContext } from "@/lib/workspaces/current";
import { getOptionalPlatformAdmin } from "@/lib/platform-admin/authorization";

export const dynamic = "force-dynamic";

export default async function AccountSecurityPage({ searchParams }: { searchParams: Promise<{ required?: string }> }) {
  const { supabase, user, workspace, role, displayName } = await getDashboardContext({ enforceMfa: false });
  const platformAdmin = await getOptionalPlatformAdmin();
  const assurance = await readAssuranceState(supabase.auth);
  const destination = assuranceDestination(
    platformAdmin ? "platform-admin" : role,
    assurance,
    "/dashboard/settings/security",
  );
  if (destination?.startsWith("/auth/mfa")) redirect(destination);
  const requiredEnrollment = destination === "/dashboard/settings/security?required=mfa";
  if (!destination && (await searchParams)?.required === "mfa") redirect("/dashboard");

  const panel = <AccountSecurityPanel email={user.email ?? "Email unavailable"} requiredEnrollment={requiredEnrollment} />;
  if (requiredEnrollment) {
    return <RestrictedSecurityShell>{panel}</RestrictedSecurityShell>;
  }
  return (
    <AppShell displayName={displayName} role={role} workspaceName={workspace.name}>
      {panel}
    </AppShell>
  );
}
