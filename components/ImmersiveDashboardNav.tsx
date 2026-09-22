import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions";
import ScopeForgeWordmark from "@/components/brand/ScopeForgeWordmark";
import SideNav from "@/components/SideNav";

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
          <span className="workspaceNavLabel">WORKSPACE</span>
          <SideNav />
        </div>
        <div className="immersiveDashboardIdentity">
          <div className="immersiveWorkspaceIdentity">
            <span>{workspaceName}</span>
            <small>{role}</small>
          </div>
          <Link className="immersiveUserIdentity" href="/dashboard/settings/security" aria-label={`Account & security for ${displayName}`}>
            {displayName.slice(0, 2).toUpperCase()}
          </Link>
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
