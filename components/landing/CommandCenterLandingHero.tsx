import Link from "next/link";
import {
  ArrowRight,
  Box,
  Bug,
  CirclePlay,
  GitBranch,
  Radar,
  ShieldCheck,
} from "lucide-react";
import AttackSurfaceScene from "@/components/landing/AttackSurfaceScene";
import SceneMonitoringToggle from "@/components/landing/SceneMonitoringToggle";

const metricCards = [
  { icon: Box, value: "14,892", label: "Verified assets", trend: "↑ 12% this week", tone: "teal" },
  { icon: Radar, value: "3,271", label: "Active findings", trend: "↓ 8% this week", tone: "teal" },
  { icon: GitBranch, value: "523", label: "Risk paths", trend: "↑ 5 new", tone: "teal" },
  { icon: ShieldCheck, value: "92", label: "Exposure score", trend: "Medium", tone: "amber" },
] as const;

export default function CommandCenterLandingHero() {
  return (
    <section className="commandHero commandHeroV4" aria-labelledby="command-hero-title">
      <div className="commandHeroGrid" aria-hidden="true" />

      <div className="commandHeroCopy commandHeroCopyV4" data-testid="command-copy">
        <span className="commandHeroEyebrow">LIVING ATTACK SURFACE</span>
        <h1 id="command-hero-title">Understand the risk before it becomes <span>an incident.</span></h1>
        <p className="commandHeroLead">
          ScopeForge continuously discovers, verifies, and maps your digital attack surface so you can eliminate exposure paths attackers would use to reach you.
        </p>
        <div className="commandHeroActions">
          <Link className="commandHeroPrimary" href="/auth/sign-up">Explore the platform <ArrowRight size={15} /></Link>
          <a className="commandHeroSecondary" href="#platform">See it in action <CirclePlay size={15} /></a>
        </div>
      </div>

      <div className="commandHeroScene commandHeroSceneV4" data-testid="command-scene">
        <AttackSurfaceScene />
      </div>

      <div className="commandMetricArea commandMetricAreaV4" data-testid="command-metrics">
        <span className="commandIllustrativeLabel">Illustrative platform telemetry</span>
        <div className="commandMetricGrid commandMetricGridV4">
          {metricCards.map(({ icon: Icon, value, label, trend, tone }) => (
            <article className="commandMetricCard commandMetricCardV4" key={label}>
              <span className={`commandMetricIcon commandMetricIcon-${tone}`}><Icon size={16} /></span>
              <div>
                <strong>{value}</strong>
                <span>{label}</span>
                <small>{trend}</small>
              </div>
            </article>
          ))}
        </div>
      </div>

      <article className="commandOverviewPanel commandOverviewPanelV4" data-testid="command-overview">
        <div className="commandOverviewHeading">
          <span>Attack Surface Overview</span>
          <small><i /> Live illustration</small>
        </div>
        <div className="commandOverviewBody">
          <div className="commandExposureGauge">
            <div className="commandExposureRing"><span>92</span><small>/ 100</small></div>
            <p>Exposure score</p>
            <em>Medium risk</em>
          </div>
          <div className="commandOverviewList">
            <div><span><i className="commandDot commandDotTeal" /> Internet facing</span><strong>7,218</strong></div>
            <div><span><i className="commandDot commandDotCyan" /> Cloud assets</span><strong>3,901</strong></div>
            <div><span><i className="commandDot commandDotAmber" /> Identities</span><strong>1,126</strong></div>
            <div><span><i className="commandDot commandDotRisk" /> Third parties</span><strong>647</strong></div>
          </div>
          <div className="commandRiskPath">
            <span>Top risk path</span>
            <strong>Internet → Web App → IAM → Data Store <em>Critical</em></strong>
            <div><small>Likely impact <b>High</b></small><small>Exploitability <b>High</b></small></div>
            <Link href="/auth/sign-up">Investigate path <ArrowRight size={13} /></Link>
          </div>
        </div>
      </article>

      <div className="commandRuntimeBar commandRuntimeBarV4" data-testid="command-runtime" aria-label="Illustrative runtime status">
        <span><i className="commandRuntimePulse" /><small>Runtime</small><strong>24:07:18:42</strong></span>
        <span><Radar size={15} /><small>Sensors</small><strong>182</strong></span>
        <span><Bug size={15} /><small>Coverage</small><strong>98%</strong></span>
        <SceneMonitoringToggle />
      </div>
    </section>
  );
}
