import Link from "next/link";
import { ArrowRight, Boxes, Bug, CircleCheck, ScanSearch, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import { getDashboardContext } from "@/lib/workspaces/current";

export const dynamic = "force-dynamic";

const modules = [
  ["Asset control", "Target registration, proof of control, quotas and audit events", "Phase 2", Boxes],
  ["Code security", "SAST, secrets, dependency risk, SBOM and IaC analysis", "Phase 3", Bug],
  ["Runtime security", "Authorized web and API security testing", "Phase 4", ScanSearch],
  ["Security Stories", "Explain, connect, prepare, remediate and verify", "Phase 5", ShieldCheck]
] as const;

export default async function DashboardPage() {
  const { supabase, workspace, role, displayName } = await getDashboardContext();
  const { data: assets, error } = await supabase
    .from("assets")
    .select("id,verification_status,created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const totalAssets = assets?.length ?? 0;
  const verifiedAssets = (assets ?? []).filter((asset) => asset.verification_status === "verified");
  const firstNeedsProof = (assets ?? []).find((asset) => asset.verification_status !== "verified");

  const nextHref = totalAssets === 0
    ? "/dashboard/assets/new"
    : firstNeedsProof
      ? `/dashboard/assets/${firstNeedsProof.id}`
      : "/dashboard/assets";
  const nextTitle = totalAssets === 0
    ? "Register your first asset"
    : firstNeedsProof
      ? "Verify asset control"
      : "Your registered assets are verified";
  const nextCopy = totalAssets === 0
    ? "Start by defining an application or repository that belongs in this workspace's authorized scope."
    : firstNeedsProof
      ? "Proof of control is the next safety boundary before future remote testing can be enabled."
      : "Phase 2 does not start scans automatically. You can review your verified scope while scanner phases are built.";

  return (
    <AppShell displayName={displayName} workspaceName={workspace.name} role={role}>
      <section className="pageHeader">
        <div><span className="sectionEyebrow">Security workspace</span><h1>Know what you own before you test it.</h1><p>ScopeForge now tracks authorized assets and proof of control. The scanner execution plane remains deliberately disabled while the safety boundary is built.</p></div>
        <div className="healthBadge"><CircleCheck size={16} /> Phase 2 controls active</div>
      </section>

      <section className="grid4">
        <article className="statCard"><div><span>Workspace isolation</span><ShieldCheck size={18} /></div><strong>RLS</strong><small>Member-scoped data boundary</small></article>
        <article className="statCard"><div><span>Registered assets</span><Boxes size={18} /></div><strong>{totalAssets}</strong><small>Trial limit: 10</small></article>
        <article className="statCard"><div><span>Verified assets</span><CircleCheck size={18} /></div><strong>{verifiedAssets.length}</strong><small>Proof of control confirmed</small></article>
        <article className="statCard"><div><span>Open findings</span><Bug size={18} /></div><strong>0</strong><small>Scanners are not enabled yet</small></article>
      </section>

      <section className="nextAction">
        <div><span className="sectionEyebrow">Next action</span><h2>{nextTitle}</h2><p>{nextCopy}</p></div>
        <Link className="primaryButton compact" href={nextHref}>{firstNeedsProof ? "Continue verification" : totalAssets === 0 ? "Register asset" : "Review assets"} <ArrowRight size={15} /></Link>
      </section>

      <section className="dashboardGrid" id="phase-roadmap">
        <article className="panel">
          <div className="panelTitle"><div><span>Product roadmap</span><h2>From scope to verified risk</h2></div><span className="statusDot">Phase 2</span></div>
          <div className="moduleList">
            {modules.map(([title, copy, phase, Icon]) => <div className="moduleRow" key={title}><span className="moduleIcon"><Icon size={17} /></span><div><strong>{title}</strong><p>{copy}</p></div><span className="modulePhase">{phase}</span></div>)}
          </div>
        </article>
        <article className="panel">
          <div className="panelTitle"><div><span>Phase 2 controls</span><h2>Authorization before execution</h2></div></div>
          <div className="checkList">
            <div><CircleCheck size={16} /><span>Workspace-scoped asset inventory</span></div>
            <div><CircleCheck size={16} /><span>HTTPS proof-of-control challenge</span></div>
            <div><CircleCheck size={16} /><span>Verification rate limits</span></div>
            <div><CircleCheck size={16} /><span>Append-only audit activity</span></div>
            <div><CircleCheck size={16} /><span>Trusted verification-state writes</span></div>
          </div>
          <div className="guardrail"><ShieldCheck size={17} /><p><strong>Scanning remains locked.</strong> Phase 2 establishes scope and proof only. Later scanner phases must preserve these authorization controls.</p></div>
        </article>
      </section>
    </AppShell>
  );
}
