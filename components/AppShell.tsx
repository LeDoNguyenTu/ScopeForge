import Link from "next/link";
import { Boxes, Bug, FileText, Gauge, LogOut, Radar, ScanSearch, Settings, ShieldCheck } from "lucide-react";
import { signOut } from "@/app/actions";

const nav = [
  ["/dashboard", "Overview", Gauge],
  ["/dashboard#assets", "Assets", Boxes],
  ["/dashboard#scans", "Scans", ScanSearch],
  ["/dashboard#findings", "Findings", Bug],
  ["/dashboard#reports", "Reports", FileText]
] as const;

export default function AppShell({ children, displayName, workspaceName, role }: { children: React.ReactNode; displayName: string; workspaceName: string; role: string }) {
  return (
    <div className="appGrid">
      <aside className="sidebar">
        <Link className="brand sideBrand" href="/"><span className="brandMark"><ShieldCheck size={18} /></span><span>ScopeForge</span></Link>
        <div className="workspaceChip"><span>{workspaceName.slice(0, 1).toUpperCase()}</span><div><strong>{workspaceName}</strong><small>{role}</small></div></div>
        <nav className="sideNav">
          {nav.map(([href, label, Icon], index) => <Link className={`sideLink ${index === 0 ? "active" : ""}`} href={href} key={label}><Icon size={17} /><span>{label}</span></Link>)}
        </nav>
        <div className="sideDivider" />
        <nav className="sideNav">
          <a className="sideLink" href="#phase-roadmap"><Radar size={17} /><span>Roadmap</span></a>
          <a className="sideLink" href="#settings"><Settings size={17} /><span>Settings</span></a>
        </nav>
        <div className="sideFoot">
          <div className="userMini"><span>{displayName.slice(0, 2).toUpperCase()}</span><div><strong>{displayName}</strong><small>Authenticated</small></div></div>
          <form action={signOut}><button className="signOutButton" type="submit"><LogOut size={15} /> Sign out</button></form>
        </div>
      </aside>
      <main className="appMain">
        <header className="topbar"><div><span>Workspace</span><strong>{workspaceName}</strong></div><span className="phasePill"><i /> Phase 1 foundation</span></header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
