import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions";
import ScopeForgeWordmark from "@/components/brand/ScopeForgeWordmark";

export default function ImmersiveDashboardNav({
  displayName,
  workspaceName,
  role,
}: {
  displayName: string;
  workspaceName: string;
  role: string;
}) {
  return (
    <header className="immersiveDashboardHeader">
      <nav className="immersiveDashboardNav" aria-label="Dashboard command navigation">
        <Link className="immersiveDashboardBrand" href="/" aria-label="ScopeForge home">
          <ScopeForgeWordmark />
        </Link>
        <div className="immersiveDashboardLinks">
          <Link href="/dashboard">Overview</Link>
          <Link href="/dashboard/assets">Assets</Link>
          <Link href="/dashboard/findings">Findings</Link>
        </div>
        <div className="immersiveDashboardIdentity">
          <div className="immersiveWorkspaceIdentity">
            <span>{workspaceName}</span>
            <small>{role}</small>
          </div>
          <div className="immersiveUserIdentity" aria-label={`Signed in as ${displayName}`}>
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <form action={signOut}>
            <button type="submit" className="immersiveSignOut" aria-label="Sign out">
              <LogOut size={15} />
            </button>
          </form>
        </div>
      </nav>
    </header>
  );
}
