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
import CinematicSurface from "@/components/landing/CinematicSurface";

const metricCards = [
  { icon: Box, value: "14,892", label: "Verified assets", trend: "Example inventory", tone: "teal" },
  { icon: Radar, value: "3,271", label: "Active findings", trend: "Example findings", tone: "teal" },
  { icon: GitBranch, value: "523", label: "Risk paths", trend: "Illustrative paths", tone: "teal" },
  { icon: ShieldCheck, value: "92", label: "Exposure score", trend: "Example score", tone: "amber" },
] as const;

export default function CommandCenterLandingHero() {
  return (
    <section className="commandHero" aria-labelledby="command-hero-title">
      <div className="commandHeroGrid" aria-hidden="true" />

      <div className="commandHeroCopy">
        <span className="commandHeroEyebrow">LIVING ATTACK SURFACE</span>
        <h1 id="command-hero-title">Understand the risk before it becomes <span>an incident.</span></h1>
        <p className="commandHeroLead">
          Discover your attack surface, understand the evidence, and move from exposure to a verified fix. One connected view of your security work.
        </p>
        <div className="commandHeroActions">
          <Link className="commandHeroPrimary" href="/auth/sign-up">Explore the platform <ArrowRight size={15} /></Link>
          <a className="commandHeroSecondary" href="#platform">See it in action <CirclePlay size={15} /></a>
        </div>
      </div>

      <div className="commandHeroScene">
        <CinematicSurface />
      </div>

      <div className="commandMetricArea">
        <span className="commandIllustrativeLabel">Illustrative platform telemetry</span>
        <div className="commandMetricGrid">
          {metricCards.map(({ icon: Icon, value, label, trend, tone }) => (
            <article className="commandMetricCard" key={label}>
              <span className={`commandMetricIcon commandMetricIcon-${tone}`}><Icon size={16} /></span>
              <div>
                <strong>{value}</strong>
                <span>{label}</span>
                <small>{trend}</small>
              </div>
            </article>
          ))}
        </div>

        <article className="commandOverviewPanel">
          <div className="commandOverviewHeading">
            <span>Attack Surface Overview</span>
            <small><i /> Example model</small>
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
              <span>Illustrative risk path</span>
              <strong>Internet → Web App → IAM → Data Store <em>Critical</em></strong>
              <div><small>Likely impact <b>High</b></small><small>Exploitability <b>High</b></small></div>
              <Link href="/auth/sign-up">Investigate path <ArrowRight size={13} /></Link>
            </div>
          </div>
        </article>
      </div>

      <div className="commandRuntimeBar" aria-label="Illustrative runtime status">
        <span><i className="commandRuntimePulse" /><small>Platform view</small><strong>Illustrative</strong></span>
        <span><Radar size={15} /><small>Example sensors</small><strong>182</strong></span>
        <span><Bug size={15} /><small>Example coverage</small><strong>98%</strong></span>
      </div>
    </section>
  );
}
