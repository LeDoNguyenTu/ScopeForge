import Link from "next/link";
import { ArrowRight, Boxes, Bug, CheckCircle2, ChevronDown, CircleCheck, Plus, ShieldCheck } from "lucide-react";
import { DashboardResources } from "@/components/ResourceLibrary";
import DashboardWorkbench, { type DashboardFinding } from "@/components/dashboard/DashboardWorkbench";
import WebGLAttackSurface from "@/components/dashboard/WebGLAttackSurface";
import type { AttackSurfaceAssetInput, AttackSurfaceModel } from "@/lib/dashboard/attack-surface-model";

export interface DashboardNextAction { href: string; label: string; title: string; copy: string; }

export default function ImmersiveDashboardExperience({ model, nextAction, assets = [], findings = [] }: {
  model: AttackSurfaceModel;
  nextAction: DashboardNextAction;
  assets?: readonly AttackSurfaceAssetInput[];
  findings?: readonly DashboardFinding[];
}) {
  const { metrics } = model;
  const steps = [
    { title: "Register your scope", done: metrics.registeredAssets > 0, href: "/dashboard/assets/new", copy: "Add the assets your team controls." },
    { title: "Verify ownership", done: metrics.registeredAssets > 0 && metrics.verifiedAssets === metrics.registeredAssets, href: nextAction.href, copy: "Confirm control before remote testing." },
    { title: "Review security evidence", done: false, href: "/dashboard/findings", copy: metrics.openFindings ? `${metrics.openFindings} findings need review.` : "Evidence appears after a supported scan." },
  ];
  return (
    <div className="saasDashboard">
      <section className="saasPageHeading"><div><span className="saasEyebrow">WORKSPACE OVERVIEW</span><h1>Security overview</h1><p>Your assets, security evidence, and next steps in one place.</p></div><Link className="saasPrimary" href="/dashboard/assets/new"><Plus size={16} /> Register asset</Link></section>
      <section className="saasMetrics" aria-label="Workspace security metrics">
        <Link href="/dashboard/findings"><div><span>Open findings</span><Bug size={18} /></div><strong>{metrics.openFindings}</strong><small>Review and prioritize evidence <ArrowRight size={12} /></small></Link>
        <Link href="/dashboard/assets"><div><span>Registered assets</span><Boxes size={18} /></div><strong>{metrics.registeredAssets}</strong><small>Applications, APIs, and repositories</small></Link>
        <Link href="/dashboard/assets"><div><span>Verified assets</span><CircleCheck size={18} /></div><strong>{metrics.verifiedAssets}<em> / {metrics.registeredAssets}</em></strong><small>Ownership confirmed</small></Link>
        <Link href="/dashboard/assets"><div><span>Verification coverage</span><ShieldCheck size={18} /></div><strong>{metrics.verificationPercent}%</strong><div className="saasCoverageTrack" aria-hidden="true"><i style={{ width: `${metrics.verificationPercent}%` }} /></div></Link>
      </section>
      <section className="saasNextAction"><span className="saasActionIcon"><ShieldCheck size={22} /></span><div><span className="saasEyebrow">RECOMMENDED NEXT STEP</span><h2>{nextAction.title}</h2><p>{nextAction.copy}</p></div><Link href={nextAction.href}>{nextAction.label} <ArrowRight size={15} /></Link></section>
      <div className="saasMainGrid">
        <DashboardWorkbench assets={assets} findings={findings} totalFindings={metrics.openFindings} />
        <aside className="saasWorkflow" aria-label="Workspace workflow"><span className="saasEyebrow">SCOPE TO PROOF</span><h2>Your security workflow</h2><p>Keep each step connected to evidence.</p><ol>{steps.map((step, index) => <li key={step.title}><span className={step.done ? "isComplete" : ""}>{step.done ? <CheckCircle2 size={17} /> : index + 1}</span><div><Link href={step.href}>{step.title} <ArrowRight size={12} /></Link><p>{step.copy}</p></div></li>)}</ol><Link className="saasGuideLink" href="/dashboard/resources">Open checklists and guides <ArrowRight size={14} /></Link></aside>
      </div>
      <details className="saasMapPanel"><summary><span><Boxes size={18} /><strong>Attack surface map</strong><small>{metrics.registeredAssets} registered assets</small></span><ChevronDown size={17} /></summary><div className="saasMapBody"><p>Showing up to 10 assets, prioritized by sampled finding severity. Verified ownership does not mean an asset is vulnerability-free.</p><div className="livingMapCanvas"><WebGLAttackSurface model={model} /></div><ol className="mobileMapLegend">{model.nodes.map((node, index) => <li key={node.id}><Link href={`/dashboard/assets/${node.id}`}><span className={`mapLegendNumber mapLegendNumber-${node.state}`}>{index + 1}</span><div><strong>{node.label}</strong><small>{node.findingCount ? `${node.findingCount} sampled findings` : node.verificationStatus === "verified" ? "Verified ownership" : "Needs verification"}</small></div><ArrowRight size={13} /></Link></li>)}</ol><Link href="/dashboard/assets">Open asset inventory <ArrowRight size={14} /></Link></div></details>
      <DashboardResources />
    </div>
  );
}
