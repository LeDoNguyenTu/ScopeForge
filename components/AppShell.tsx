import ImmersiveDashboardNav from "@/components/ImmersiveDashboardNav";
import Link from "next/link";
import { BookOpen, ShieldCheck } from "lucide-react";

export default function AppShell({
  children,
  displayName,
  workspaceName,
  role,
  platformAdminHref,
}: {
  children: React.ReactNode;
  displayName: string;
  workspaceName: string;
  role: string;
  variant?: "default" | "immersive";
  platformAdminHref?: string;
}) {
  return (
    <div className="workspaceAppShell">
      <a className="skipLink" href="#workspace-content">Skip to content</a>
      <ImmersiveDashboardNav displayName={displayName} workspaceName={workspaceName} role={role} />
      <main className="workspaceContent" id="workspace-content" tabIndex={-1}>
        <div className="workspaceToolbar">
          <span>{workspaceName} <span>/</span> Security workspace</span>
          <span>
            {platformAdminHref ? <Link href={platformAdminHref}><ShieldCheck size={15} /> Platform admin</Link> : null}
            <Link href="/dashboard/resources"><BookOpen size={15} /> Resources</Link>
          </span>
        </div>
        {children}
      </main>
    </div>
  );
}
