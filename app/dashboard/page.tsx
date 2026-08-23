import { redirect } from "next/navigation";
import { Boxes, Bug, CircleCheck, Database, ScanSearch, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";

const modules = [
  ["Asset inventory", "Target registration and ownership verification", "Phase 2", Boxes],
  ["Scan orchestration", "Safe profiles, jobs and worker lifecycle", "Phase 2", ScanSearch],
  ["Code security", "SAST, secrets, SCA and IaC analysis", "Phase 3", Bug],
  ["Runtime security", "Authorized web and API DAST", "Phase 4", ShieldCheck]
] as const;

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("workspace_members").select("role, workspaces(id,name,slug)").eq("user_id", user.id).limit(1)
  ]);

  const membership = memberships?.[0];
  const workspace = Array.isArray(membership?.workspaces) ? membership?.workspaces[0] : membership?.workspaces;
  if (!membership || !workspace) throw new Error("Workspace onboarding is incomplete.");

  const displayName = profile?.display_name || user.email?.split("@")[0] || "ScopeForge user";

  return (
    <AppShell displayName={displayName} workspaceName={workspace.name} role={membership.role}>
      <section className="pageHeader">
        <div><span className="sectionEyebrow">Security workspace</span><h1>Foundation is online.</h1><p>Your account, isolated workspace and row-level access boundary are active. Scanner data is intentionally not enabled until Phase 2.</p></div>
        <div className="healthBadge"><CircleCheck size={16} /> Supabase healthy</div>
      </section>

      <section className="grid4">
        <article className="statCard"><div><span>Workspace isolation</span><ShieldCheck size={18} /></div><strong>RLS</strong><small>Member-scoped policies</small></article>
        <article className="statCard"><div><span>Database region</span><Database size={18} /></div><strong>SG</strong><small>ap-southeast-1</small></article>
        <article className="statCard"><div><span>Open findings</span><Bug size={18} /></div><strong>0</strong><small>Scanner not enabled yet</small></article>
        <article className="statCard"><div><span>Registered assets</span><Boxes size={18} /></div><strong>0</strong><small>Begins in Phase 2</small></article>
      </section>

      <section className="dashboardGrid" id="phase-roadmap">
        <article className="panel">
          <div className="panelTitle"><div><span>Build roadmap</span><h2>What comes next</h2></div><span className="statusDot">In progress</span></div>
          <div className="moduleList">
            {modules.map(([title, copy, phase, Icon]) => <div className="moduleRow" key={title}><span className="moduleIcon"><Icon size={17} /></span><div><strong>{title}</strong><p>{copy}</p></div><span className="modulePhase">{phase}</span></div>)}
          </div>
        </article>
        <article className="panel">
          <div className="panelTitle"><div><span>Phase 1 controls</span><h2>Security baseline</h2></div></div>
          <div className="checkList">
            <div><CircleCheck size={16} /><span>Dedicated Supabase project</span></div>
            <div><CircleCheck size={16} /><span>Multi-tenant workspace model</span></div>
            <div><CircleCheck size={16} /><span>RLS on exposed tables</span></div>
            <div><CircleCheck size={16} /><span>Server-side session refresh</span></div>
            <div><CircleCheck size={16} /><span>Security response headers</span></div>
          </div>
          <div className="guardrail"><ShieldCheck size={17} /><p><strong>Authorized testing only.</strong> Active scan capabilities will require explicit target verification and bounded execution profiles.</p></div>
        </article>
      </section>
    </AppShell>
  );
}
