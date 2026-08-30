import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Bug,
  CircleCheck,
  Gauge,
  ShieldCheck,
} from "lucide-react";
import WebGLAttackSurface from "@/components/dashboard/WebGLAttackSurface";
import type { AttackSurfaceModel } from "@/lib/dashboard/attack-surface-model";

export interface DashboardNextAction {
  href: string;
  label: string;
  title: string;
  copy: string;
}

export default function ImmersiveDashboardExperience({
  model,
  nextAction,
}: {
  model: AttackSurfaceModel;
  nextAction: DashboardNextAction;
}) {
  const { metrics, priority } = model;

  return (
    <div className="livingDashboard">
      <section className="livingDashboardHero" aria-labelledby="living-attack-surface-title">
        <div className="livingDashboardEditorial">
          <span className="livingDashboardEyebrow">LIVING ATTACK SURFACE</span>
          <h1 id="living-attack-surface-title">Understand the risk before it becomes an incident.</h1>
          <p>
            ScopeForge maps verified scope and the security evidence already attached to this workspace, so every next action stays tied to assets you actually control.
          </p>
          <div className="livingDashboardActions">
            <Link className="livingPrimaryAction" href={nextAction.href}>
              {nextAction.label} <ArrowRight size={16} />
            </Link>
            <Link className="livingSecondaryAction" href="/dashboard/assets">
              Explore assets
            </Link>
          </div>

          <div className="livingMetricBand" aria-label="Workspace security metrics">
            <article className="livingMetricCard">
              <span className="livingMetricIcon"><Boxes size={16} /></span>
              <div><strong>{metrics.registeredAssets}</strong><span>Registered assets</span></div>
            </article>
            <article className="livingMetricCard">
              <span className="livingMetricIcon livingMetricIconHealthy"><CircleCheck size={16} /></span>
              <div><strong>{metrics.verifiedAssets}</strong><span>Verified assets</span></div>
            </article>
            <article className="livingMetricCard">
              <span className="livingMetricIcon livingMetricIconRisk"><Bug size={16} /></span>
              <div><strong>{metrics.openFindings}</strong><span>Open findings</span></div>
            </article>
            <article className="livingMetricCard">
              <span className="livingMetricIcon"><Gauge size={16} /></span>
              <div><strong>{metrics.verificationPercent}%</strong><span>Verification coverage</span></div>
            </article>
          </div>
        </div>

        <div className="livingDashboardScene">
          <WebGLAttackSurface model={model} />
          <div className="livingSceneStatus" aria-label="Attack surface renderer status">
            <span><i className="livingScenePulse" /> Topology active</span>
            <span>{model.nodes.length} visual nodes</span>
            <span>{metrics.affectedAssets} affected assets</span>
          </div>
        </div>

        <div className="livingDashboardLower">
          <article className="livingOverviewPanel">
            <div className="livingPanelHeading">
              <div>
                <span>Attack Surface Overview</span>
                <h2>Verified workspace scope</h2>
              </div>
              <span className="livingRealDataPill"><i /> Real workspace data</span>
            </div>
            <div className="livingOverviewContent">
              <div
                className="livingCoverageRing"
                style={{ background: `conic-gradient(var(--forge-teal) ${metrics.verificationPercent}%, rgba(123,145,154,.12) 0)` }}
                aria-label={`${metrics.verificationPercent}% of registered assets are verified`}
              >
                <div><strong>{metrics.verificationPercent}%</strong><span>verified</span></div>
              </div>
              <div className="livingOverviewRows">
                <div><span>Registered scope</span><strong>{metrics.registeredAssets}</strong></div>
                <div><span>Proof confirmed</span><strong>{metrics.verifiedAssets}</strong></div>
                <div><span>Assets with sampled active evidence</span><strong>{metrics.affectedAssets}</strong></div>
              </div>
            </div>
          </article>

          <article className="livingPriorityPanel">
            <span>Highest priority evidence</span>
            {priority ? (
              <>
                <div className={`livingPrioritySeverity livingPrioritySeverity-${priority.severity}`}>
                  {priority.severity}
                </div>
                <h2>{priority.assetName}</h2>
                <p>{priority.title}</p>
                <Link href="/dashboard/findings">Investigate evidence <ArrowRight size={14} /></Link>
              </>
            ) : (
              <div className="livingPriorityEmpty">
                <ShieldCheck size={18} />
                <p>No active finding evidence in this workspace view.</p>
              </div>
            )}
          </article>

          <article className="livingNextPanel">
            <span>Next action</span>
            <h2>{nextAction.title}</h2>
            <p>{nextAction.copy}</p>
            <Link href={nextAction.href}>{nextAction.label} <ArrowRight size={14} /></Link>
          </article>
        </div>
      </section>

      <section className="livingSafetyNote">
        <ShieldCheck size={16} />
        <p>Remote testing remains limited to verified targets, reviewed request profiles, fixed budgets, and trusted server-side authorization.</p>
      </section>
    </div>
  );
}
