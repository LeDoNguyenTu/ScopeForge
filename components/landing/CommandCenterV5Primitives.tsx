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
import SceneMonitoringToggle from "@/components/landing/SceneMonitoringToggle";

const metricCards = [
  { icon: Box, value: "14,892", label: "Verified assets", trend: "Example inventory", tone: "teal" },
  { icon: Radar, value: "3,271", label: "Active findings", trend: "Example findings", tone: "cyan" },
  { icon: GitBranch, value: "523", label: "Risk paths", trend: "Illustrative paths", tone: "teal" },
  { icon: ShieldCheck, value: "92", label: "Exposure score", trend: "Medium example", tone: "amber" },
] as const;

export function CommandCenterV5Copy({ titleId, mobile = false }: { titleId: string; mobile?: boolean }) {
  return (
    <div className={`ccV5Copy${mobile ? " ccV5Copy-mobile" : ""}`}>
      <span className="ccV5Eyebrow"><i /> Living attack surface</span>
      <h1 id={titleId}>Understand the risk before it becomes <span>an incident.</span></h1>
      <p>
        ScopeForge discovers, verifies, and maps the attack surface into one evidence-first view so teams can see the path from exposure to impact before attackers do.
      </p>
      <div className="ccV5Actions">
        <Link className="ccV5Primary" href="/auth/sign-up">Explore the platform <ArrowRight size={18} /></Link>
        <a className="ccV5Secondary" href="#platform"><CirclePlay size={18} /> See it in action</a>
      </div>
    </div>
  );
}

export function CommandCenterV5Metrics({ mobile = false }: { mobile?: boolean }) {
  return (
    <div className={`ccV5Metrics${mobile ? " ccV5Metrics-mobile" : ""}`} data-testid="command-metrics">
      <div className="ccV5SectionLabel"><span>Illustrative platform telemetry</span><small>Public example</small></div>
      <div className="ccV5MetricGrid">
        {metricCards.map(({ icon: Icon, value, label, trend, tone }) => (
          <article className="ccV5MetricCard" data-tone={tone} key={label}>
            <span className="ccV5MetricIcon"><Icon size={28} /></span>
            <strong>{value}</strong>
            <span>{label}</span>
            <small>{trend}</small>
          </article>
        ))}
      </div>
    </div>
  );
}

export function CommandCenterV5Overview({ mobile = false }: { mobile?: boolean }) {
  return (
    <article className={`ccV5Overview${mobile ? " ccV5Overview-mobile" : ""}`} data-testid="command-overview">
      <div className="ccV5OverviewHeading">
        <div><span>Attack surface overview</span><small>Illustrative risk topology</small></div>
        <span className="ccV5OverviewStatus"><i /> Example model</span>
      </div>
      <div className="ccV5OverviewBody">
        <div className="ccV5Exposure">
          <div className="ccV5ExposureRing"><strong>92</strong><small>/100</small></div>
          <div><span>Exposure score</span><strong>Medium risk</strong></div>
        </div>
        <div className="ccV5AssetMix">
          <span><i data-tone="teal" /> Internet facing <strong>7,218</strong></span>
          <span><i data-tone="cyan" /> Cloud assets <strong>3,901</strong></span>
          <span><i data-tone="amber" /> Identities <strong>1,126</strong></span>
          <span><i data-tone="risk" /> Third parties <strong>647</strong></span>
        </div>
        <div className="ccV5RiskPath">
          <span>Top illustrative risk path</span>
          <strong>Internet <b>→</b> Web App <b>→</b> IAM <b>→</b> Data Store <em>Critical</em></strong>
          <Link href="/auth/sign-up">Investigate path <ArrowRight size={16} /></Link>
        </div>
      </div>
    </article>
  );
}

export function CommandCenterV5Runtime({ mobile = false }: { mobile?: boolean }) {
  return (
    <div className={`ccV5Runtime${mobile ? " ccV5Runtime-mobile" : ""}`} data-testid="command-runtime" aria-label="Illustrative scene runtime status">
      <span className="ccV5RuntimeState"><i /><small>Scene</small><strong>Running</strong></span>
      <span><Radar size={22} /><small>Example sensors</small><strong>182</strong></span>
      <span><Bug size={22} /><small>Example coverage</small><strong>98%</strong></span>
      <SceneMonitoringToggle />
    </div>
  );
}
