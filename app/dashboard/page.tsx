import Link from "next/link";
import { ArrowRight, Boxes, Bug, CircleCheck, ScanSearch, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import { getDashboardContext } from "@/lib/workspaces/current";

export const dynamic = "force-dynamic";

const modules = [
  ["Asset control", "Target registration, proof of control, quotas and audit events", "Phase 2", Boxes],
  ["Code security", "SAST, secrets, dependency risk, SBOM and IaC analysis", "Phase 3", Bug],
  ["Runtime security", "Authorized passive observation and bounded active validation", "Phase 4", ScanSearch],
  ["Hosted findings", "Canonical evidence, recurrence and trusted lifecycle workflow", "Phase 5A", ShieldCheck]
] as const;

export default async function DashboardPage() {
  const { supabase, workspace, role, displayName } = await getDashboardContext();
  const [
    { data: assets, error: assetsError },
    { data: findings, error: findingsError },
  ] = await Promise.all([
    supabase
      .from("assets")
      .select("id,verification_status,created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("security_findings")
      .select("finding_id,lifecycle_state")
      .eq("workspace_id", workspace.id),
  ]);
  if (assetsError) throw new Error(assetsError.message);
  if (findingsError) throw new Error(findingsError.message);

  const totalAssets = assets?.length ?? 0;
  const verifiedAssets = (assets ?? []).filter((asset) => asset.verification_status === "verified");
  const firstNeedsProof = (assets ?? []).find((asset) => asset.verification_status !== "verified");
  const openWorkCount = (findings ?? []).filter((finding) =>
    !["verified_fixed", "accepted_risk", "false_positive"].includes(finding.lifecycle_state)).length;

  const nextHref = totalAssets === 0
    ? "/dashboard/assets/new"
    : firstNeedsProof
      ? `/dashboard/assets/${firstNeedsProof.id}`
      : openWorkCount > 0
        ? "/dashboard/findings"
        : "/dashboard/assets";
  const nextTitle = totalAssets === 0
    ? "Register your first asset"
    : firstNeedsProof
      ? "Verify asset control"
      : openWorkCount > 0
        ? `${openWorkCount} finding${openWorkCount === 1 ? "" : "s"} need review`
        : "Your verified scope is ready";
  const nextCopy = totalAssets === 0
    ? "Start by defining an application or repository that belongs in this workspace's authorized scope."
    : firstNeedsProof
      ? "Proof of control remains the safety boundary before any remote observation or active validation can run."
      : openWorkCount > 0
        ? "Review canonical evidence, validation confidence and lifecycle history before deciding the next remediation step."
        : "Review verified assets and run only the bounded runtime workflows that match the authorization policy.";
  const nextActionLabel = totalAssets === 0
    ? "Register asset"
    : firstNeedsProof
      ? "Continue verification"
      : openWorkCount > 0
        ? "Review findings"
        : "Review assets";

  return (
    <AppShell displayName={displayName} workspaceName={workspace.name} role={role}>
      <section className="pageHeader">
        <div><span className="sectionEyebrow">Security workspace</span><h1>Know what you own. Test only what you control.</h1><p>ScopeForge combines verified scope, bounded runtime testing and a workspace-scoped finding ledger so security results stay attributable, reviewable and auditable.</p></div>
        <div className="healthBadge"><CircleCheck size={16} /> Runtime ledger active</div>
      </section>

      <section className="grid4">
        <article className="statCard"><div><span>Workspace isolation</span><ShieldCheck size={18} /></div><strong>RLS</strong><small>Member-scoped data boundary</small></article>
        <article className="statCard"><div><span>Registered assets</span><Boxes size={18} /></div><strong>{totalAssets}</strong><small>Trial limit: 10</small></article>
        <article className="statCard"><div><span>Verified assets</span><CircleCheck size={18} /></div><strong>{verifiedAssets.length}</strong><small>Proof of control confirmed</small></article>
        <article className="statCard"><div><span>Open findings</span><Bug size={18} /></div><strong>{openWorkCount}</strong><small>Canonical records requiring review</small></article>
      </section>

      <section className="nextAction">
        <div><span className="sectionEyebrow">Next action</span><h2>{nextTitle}</h2><p>{nextCopy}</p></div>
        <Link className="primaryButton compact" href={nextHref}>{nextActionLabel} <ArrowRight size={15} /></Link>
      </section>

      <section className="dashboardGrid" id="phase-roadmap">
        <article className="panel">
          <div className="panelTitle"><div><span>Product roadmap</span><h2>From scope to verified risk</h2></div><span className="statusDot">Phase 5A</span></div>
          <div className="moduleList">
            {modules.map(([title, copy, phase, Icon]) => <div className="moduleRow" key={title}><span className="moduleIcon"><Icon size={17} /></span><div><strong>{title}</strong><p>{copy}</p></div><span className="modulePhase">{phase}</span></div>)}
          </div>
        </article>
        <article className="panel">
          <div className="panelTitle"><div><span>Execution controls</span><h2>Authorization before network authority</h2></div></div>
          <div className="checkList">
            <div><CircleCheck size={16} /><span>Workspace-scoped asset inventory and proof of control</span></div>
            <div><CircleCheck size={16} /><span>Bounded passive runtime observations</span></div>
            <div><CircleCheck size={16} /><span>Explicit owner/admin consent for active CORS validation</span></div>
            <div><CircleCheck size={16} /><span>Atomic canonical finding and evidence persistence</span></div>
            <div><CircleCheck size={16} /><span>Append-only occurrence and lifecycle history</span></div>
          </div>
          <div className="guardrail"><ShieldCheck size={17} /><p><strong>Authorization stays enforced.</strong> Runtime jobs remain bound to verified targets, fixed budgets and trusted server-side request plans rather than arbitrary browser-supplied network parameters.</p></div>
        </article>
      </section>
    </AppShell>
  );
}
