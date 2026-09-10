import Link from "next/link";
import { LogOut } from "lucide-react";
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
          <div className="immersiveUserIdentity" aria-label={`Demo persona: ${displayName}`}>
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <Link href="/" className="immersiveSignOut" aria-label="Leave demo"><LogOut size={15} /></Link>
        </div>
      </nav>
    </header>
  );
}
