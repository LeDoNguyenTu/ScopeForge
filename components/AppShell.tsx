import Link from "next/link";
import { LogOut, Radar, Settings, ShieldCheck } from "lucide-react";
import { signOut } from "@/app/actions";
import SideNav from "@/components/SideNav";

export default function AppShell({ children, displayName, workspaceName, role }: { children: React.ReactNode; displayName: string; workspaceName: string; role: string }) {
  return (
    <div className="appGrid">
      <aside className="sidebar">
        <Link className="brand sideBrand" href="/"><span className="brandMark"><ShieldCheck size={18} /></span><span>ScopeForge</span></Link>
        <div className="workspaceChip"><span>{workspaceName.slice(0, 1).toUpperCase()}</span><div><strong>{workspaceName}</strong><small>{role}</small></div></div>
        <SideNav />
        <div className="sideDivider" />
        <nav className="sideNav" aria-label="Project links">
          <Link className="sideLink" href="/dashboard#phase-roadmap"><Radar size={17} /><span>Roadmap</span></Link>
          <span className="sideLink disabledLink" aria-disabled="true"><Settings size={17} /><span>Settings</span></span>
        </nav>
        <div className="sideFoot">
          <div className="userMini"><span>{displayName.slice(0, 2).toUpperCase()}</span><div><strong>{displayName}</strong><small>Authenticated</small></div></div>
          <form action={signOut}><button className="signOutButton" type="submit"><LogOut size={15} /> Sign out</button></form>
        </div>
      </aside>
      <main className="appMain">
        <header className="topbar"><div><span>Workspace</span><strong>{workspaceName}</strong></div><span className="phasePill"><i /> Phase 2 asset control</span></header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
