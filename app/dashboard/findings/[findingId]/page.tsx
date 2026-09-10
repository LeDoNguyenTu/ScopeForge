import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bug, Clock3, FileClock, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import { demoAssets, demoFindings, demoIdentity } from "@/lib/demo/fixtures";

const label = (value: string) => value.replaceAll("_", " ");
export default async function FindingDetailPage({ params }: { params: Promise<{ findingId: string }> }) {
  const { findingId } = await params;
  const finding = demoFindings.find(item => item.finding_id === findingId);
  if (!finding) notFound();
  const asset = demoAssets.find(item => item.id === finding.asset_id)!;
  return <AppShell {...demoIdentity}>
    <section className="pageHeader"><div><Link className="sectionEyebrow" href="/dashboard/findings"><ArrowLeft size={13} /> Findings</Link><h1>{finding.title}</h1><p>Illustrative security finding for {asset.name}. Sample evidence only.</p></div><div className="healthBadge"><Bug size={16} /> {finding.severity} severity</div></section>
    <section className="grid4 assetSummaryGrid">
      <article className="statCard"><div><span>Lifecycle</span><Clock3 size={18} /></div><strong>{label(finding.lifecycle_state)}</strong><small>Sample workflow state</small></article>
      <article className="statCard"><div><span>Validation</span><ShieldCheck size={18} /></div><strong>Unvalidated</strong><small>No real scan executed</small></article>
      <article className="statCard"><div><span>Assigned owner</span><FileClock size={18} /></div><strong>{finding.owner}</strong><small>Fictional team member</small></article>
      <article className="statCard"><div><span>Evidence</span><ShieldCheck size={18} /></div><strong>1</strong><small>Illustrative evidence note</small></article>
    </section>
    <section className="dashboardGrid">
      <article className="panel"><div className="panelTitle"><div><span>Finding identity</span><h2>Security context</h2></div></div><div className="detailList"><div><span>Asset</span><Link href={`/dashboard/assets/${asset.id}`}>{asset.name}</Link></div><div><span>Example target</span><strong>{asset.canonical_target}</strong></div><div><span>Source</span><strong>Portfolio sample</strong></div><div><span>Confidence</span><strong>Inferred</strong></div><div><span>First seen (sample)</span><strong>8 September 2026</strong></div><div><span>Last seen (sample)</span><strong>10 September 2026</strong></div></div></article>
      <article className="panel"><div className="panelTitle"><div><span>Evidence</span><h2>Sample security observation</h2></div></div><div className="auditList"><div className="auditRow"><span className="moduleIcon"><ShieldCheck size={15} /></span><div><strong>Illustrative evidence</strong><p>{finding.evidence}</p></div></div></div><p className="demoNote">This note demonstrates how evidence is presented. It is not an observed fact about a real target.</p></article>
    </section>
    <section className="dashboardGrid">
      <article className="panel"><div className="panelTitle"><div><span>Developer guidance</span><h2>Remediation plan</h2></div></div><p className="demoNote">{finding.remediation}</p><div className="detailList"><div><span>Owner</span><strong>{finding.owner}</strong></div><div><span>Next review</span><strong>12 September 2026 (sample)</strong></div></div></article>
      <article className="panel"><div className="panelTitle"><div><span>Review workflow</span><h2>Verification before closure</h2></div></div><div className="auditList"><div className="auditRow"><span className="auditDot" /><div><strong>Finding recorded</strong><p>8 September · Sample evidence attached</p></div></div><div className="auditRow"><span className="auditDot" /><div><strong>Owner assigned</strong><p>9 September · {finding.owner} reviewing remediation</p></div></div><div className="auditRow"><span className="auditDot" /><div><strong>Fresh evidence required</strong><p>Retesting is unavailable in this read-only demo.</p></div></div></div></article>
    </section>
  </AppShell>;
}
