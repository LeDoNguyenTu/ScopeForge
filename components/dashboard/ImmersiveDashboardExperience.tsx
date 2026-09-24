import Link from "next/link";
import { ArrowRight, Boxes, Bug, CheckCircle2, ChevronDown, CircleCheck, Plus, ShieldCheck } from "lucide-react";
import { DashboardResources } from "@/components/ResourceLibrary";
import DashboardWorkbench, { type DashboardFinding } from "@/components/dashboard/DashboardWorkbench";
import SecurityEngineSnapshot, { type DashboardSecurityEngineState } from "@/components/dashboard/SecurityEngineSnapshot";
import type { AttackSurfaceAssetInput, AttackSurfaceModel } from "@/lib/dashboard/attack-surface-model";

export interface DashboardNextAction { href: string; label: string; title: string; copy: string; }

export default function ImmersiveDashboardExperience({ model, nextAction, engine, assets = [], findings = [] }: {
  model: AttackSurfaceModel;
  nextAction: DashboardNextAction;
  engine: DashboardSecurityEngineState;
  assets?: readonly AttackSurfaceAssetInput[];
  findings?: readonly DashboardFinding[];
}) {
  const { metrics } = model;
  const steps = [
    { title: "Register your scope", done: metrics.registeredAssets > 0, href: "/dashboard/assets/new", copy: "Add the assets your team controls." },
    { title: "Verify ownership", done: metrics.registeredAssets > 0 && metrics.verifiedAssets === metrics.registeredAssets, href: nextAction.href, copy: "Confirm control before remote testing." },
    { title: "Review security runs", done: engine.recentRunCount > 0, href: "/dashboard/security-runs", copy: engine.latestRun ? `Latest run: ${engine.latestRun.status.replaceAll("_", " ")}.` : "Authorized execution history appears here." },
  ];
  return (
    <div className="saasDashboard">
      <section className="saasPageHeading"><div><span className="saasEyebrow">WORKSPACE OVERVIEW</span><h1>Security overview</h1><p>Your assets, security evidence, and next steps in one place.</p></div><Link className="saasPrimary" href="/dashboard/assets/new"><Plus size={16} /> Register asset</Link></section>
      <section className="saasMetrics" aria-label="Workspace security metrics">
        <Link href="/dashboard/findings"><div><span>Open findings</span><Bug size={18} /></div><strong>{metrics.openFindings}</strong><small>Review and prioritize evidence <ArrowRight size={12} /></small></Link>
        <Link href="/dashboard/assets"><div><span>Registered assets</span><Boxes size={18} /></div><strong>{metrics.registeredAssets}</strong><small>Applications, APIs, and repositories</small></Link>
        <Link href="/dashboard/assets"><div><span>Verified assets</span><CircleCheck size={18} /></div><strong>{metrics.verifiedAssets}<em> / {metrics.registeredAssets}</em></strong><small>Ownership confirmed</small></Link>
        <Link href="/dashboard/assets"><div><span>Verification coverage</span><ShieldCheck size={18} /></div><strong>{metrics.verificationPercent}%</strong><progress className="saasCoverageTrack" value={metrics.verificationPercent} max={100} aria-hidden="true" /></Link>
      </section>
      <SecurityEngineSnapshot engine={engine} />
      <section className="saasNextAction"><span className="saasActionIcon"><ShieldCheck size={22} /></span><div><span className="saasEyebrow">RECOMMENDED NEXT STEP</span><h2>{nextAction.title}</h2><p>{nextAction.copy}</p></div><Link href={nextAction.href}>{nextAction.label} <ArrowRight size={15} /></Link></section>
      <div className="saasMainGrid">
        <DashboardWorkbench assets={assets} findings={findings} totalFindings={metrics.openFindings} />
        <aside className="saasWorkflow" aria-label="Workspace workflow"><span className="saasEyebrow">SCOPE TO PROOF</span><h2>Your security workflow</h2><p>Keep each step connected to evidence.</p><ol>{steps.map((step, index) => <li key={step.title}><span className={step.done ? "isComplete" : ""}>{step.done ? <CheckCircle2 size={17} /> : index + 1}</span><div><Link href={step.href}>{step.title} <ArrowRight size={12} /></Link><p>{step.copy}</p></div></li>)}</ol><Link className="saasGuideLink" href="/dashboard/resources">Open checklists and guides <ArrowRight size={14} /></Link></aside>
      </div>
      <details className="saasMapPanel" open>
        <summary><span><Boxes size={18} /><strong>Attack surface overview</strong><small>{metrics.registeredAssets} registered assets</small></span><ChevronDown size={17} /></summary>
        <div className="saasMapBody">
          <p>Your registered scope, prioritized by sampled findings. Ownership verification is separate from security results; no inferred network connections are shown.</p>
          {model.nodes.length === 0 ? <p>Register an application, API, or repository to see it here.</p> : <ul className="assetSurfaceGrid" aria-label="Registered attack surface">
            {model.nodes.map((node) => <li key={node.id}>
              <Link href={`/dashboard/assets/${node.id}`} className="assetSurfaceEntry">
                <span className="assetSurfaceKind">{node.kind.replaceAll("_", " ")} <ArrowRight aria-hidden="true" size={16} /></span>
                <strong>{node.label}</strong><span className="assetSurfaceTarget">{node.canonicalTarget}</span>
                <span className="assetSurfaceStatus">{node.verificationStatus === "verified" ? "Ownership verified" : "Needs verification"}</span>
                <span className={node.findingCount ? "assetSurfaceFindings" : "assetSurfaceEmpty"}>{node.findingCount ? `${node.findingCount} sampled findings · highest: ${node.severity}` : "No findings in the current sample"}</span>
              </Link>
            </li>)}
          </ul>}
          <Link href="/dashboard/assets">View all {metrics.registeredAssets} assets <ArrowRight size={14} /></Link>
          {metrics.registeredAssets > model.nodes.length && <p>Showing the {model.nodes.length} highest-priority assets. Open the inventory for the complete list.</p>}
        </div>
      </details>
      <DashboardResources />
    </div>
  );
}
