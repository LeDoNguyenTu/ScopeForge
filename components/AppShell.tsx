import Link from "next/link";
import { LogOut, Radar, Settings } from "lucide-react";
import { signOut } from "@/app/actions";
import ScopeForgeWordmark from "@/components/brand/ScopeForgeWordmark";
import ImmersiveDashboardNav from "@/components/ImmersiveDashboardNav";
import SideNav from "@/components/SideNav";

export default function AppShell({
  children,
  displayName,
  workspaceName,
  role,
  variant = "default",
}: {
  children: React.ReactNode;
  displayName: string;
  workspaceName: string;
  role: string;
  variant?: "default" | "immersive";
}) {
  if (variant === "immersive") {
    return (
      <div className="immersiveAppShell">
        <ImmersiveDashboardNav displayName={displayName} workspaceName={workspaceName} role={role} />
        <main className="immersiveAppMain">
          <div className="immersiveContent">{children}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="appGrid forgeAppGrid">
      <aside className="sidebar forgeSidebar">
        <Link className="brand sideBrand forgeSideBrand" href="/" aria-label="ScopeForge home"><ScopeForgeWordmark compact /></Link>
        <div className="workspaceChip forgeWorkspaceChip"><span>{workspaceName.slice(0, 1).toUpperCase()}</span><div><strong>{workspaceName}</strong><small>{role}</small></div></div>
        <SideNav />
        <div className="sideDivider" />
        <nav className="sideNav" aria-label="Project links">
          <Link className="sideLink" href="/dashboard#phase-roadmap"><Radar size={17} /><span>Roadmap</span></Link>
          <span className="sideLink disabledLink" aria-disabled="true"><Settings size={17} /><span>Settings</span></span>
        </nav>
        <div className="sideFoot forgeSideFoot">
          <div className="userMini"><span>{displayName.slice(0, 2).toUpperCase()}</span><div><strong>{displayName}</strong><small>Authenticated</small></div></div>
          <form action={signOut}><button className="signOutButton" type="submit"><LogOut size={15} /> Sign out</button></form>
        </div>
      </aside>
      <main className="appMain forgeAppMain">
        <header className="topbar forgeTopbar">
          <div className="topbarDock">
            <div className="topbarWorkspace"><span>Workspace</span><strong>{workspaceName}</strong></div>
            <span className="phasePill forgeBoundaryPill"><i /> Scope boundaries enforced</span>
          </div>
        </header>
        <div className="content forgeContent">{children}</div>
      </main>
    </div>
  );
}
