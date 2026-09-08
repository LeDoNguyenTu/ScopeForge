"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Box, Bug, ShieldCheck, Target } from "lucide-react";
import { buildSampleSurface } from "@/lib/landing/sample-surface";
import CinematicSurface from "./CinematicSurface";

export default function LandingDataIllustration() {
  const [remediated, setRemediated] = useState(false);
  const model = buildSampleSurface(remediated);
  const { metrics } = model;
  const cards = [
    { icon: Box, value: metrics.assets, label: "Registered assets", detail: "Each node is one asset" },
    { icon: Bug, value: metrics.findings, label: "Open findings", detail: "From sample records" },
    { icon: Target, value: metrics.affected, label: "Affected assets", detail: "With open findings" },
    { icon: ShieldCheck, value: `${metrics.coverage}%`, label: "Ownership verified", detail: `${metrics.verified} of ${metrics.assets} assets` },
  ];
  return <>
    <div className="commandHeroScene"><CinematicSurface model={model}/></div>
    <div className="commandMetricArea">
      <span className="commandIllustrativeLabel">Interactive example · Sample data</span>
      <div className="commandMetricGrid">{cards.map(({ icon: Icon, value, label, detail }) => <article className="commandMetricCard" key={label}><span className="commandMetricIcon"><Icon size={20}/></span><div><strong>{value}</strong><span>{label}</span><small>{detail}</small></div></article>)}</div>
      <article className="commandOverviewPanel">
        <div className="commandOverviewHeading"><span>Attack Surface Overview</span><small>Calculated from {metrics.assets} sample assets</small></div>
        <div className="commandOverviewBody">
          <div className="commandExposureGauge"><div className="commandExposureRing" role="img" aria-label={`${metrics.verified} of ${metrics.assets} assets have verified ownership`} style={{ background: `conic-gradient(#6de5ca 0 ${metrics.verified / metrics.assets * 100}%, #33434b 0 100%)` }}><span>{metrics.verified}/{metrics.assets}</span></div><p>Ownership verified</p><em>{metrics.pending} awaiting proof</em></div>
          <div className="commandOverviewList"><div><span>Verified ownership</span><strong>{metrics.verified}</strong></div><div><span>Awaiting proof</span><strong>{metrics.pending}</strong></div><div><span>Open findings</span><strong>{metrics.findings}</strong></div></div>
          <div className="sampleRiskExplanation">
            <span className="samplePathKicker">{remediated ? "After a verified fix" : "How an exposure could spread"}</span>
            {remediated ? <><h3>The example exposure path is closed.</h3><p>Fresh retest evidence closes all three sample findings. Ownership coverage stays the same: fixing a finding does not verify an asset.</p></> : <><ol aria-label="Example exposure path"><li>Web application</li><li>Identity access</li><li>Data store</li></ol><p>An exposed web credential could let someone use an identity&apos;s permissions to reach stored data.</p><small>The orange route is a potential connection in this example, not a confirmed exploit.</small></>}
            <Link href="/resources/finding-review.md">See the finding review checklist <ArrowRight size={15}/></Link>
          </div>
        </div>
      </article>
    </div>
    <div className="sampleScenarioPanel">
      <div className="sampleScenarioHeading"><strong>Explore the sample</strong><span>Watch the graph and counts change together.</span></div>
      <div className="sampleScenarioControls" role="group" aria-label="Example remediation state"><button type="button" aria-pressed={!remediated} onClick={() => setRemediated(false)}>Before remediation</button><button type="button" aria-pressed={remediated} onClick={() => setRemediated(true)}>After verified fix</button></div>
      <div className="sampleGraphLegend"><span><i/> Workspace membership</span><span><i/> Potential exposure path</span></div>
      <span className="sampleUpdate" role="status">{metrics.findings} open findings across {metrics.affected} assets. {model.path.length ? "1 potential path shown." : "No open sample path."}</span>
    </div>
  </>;
}
