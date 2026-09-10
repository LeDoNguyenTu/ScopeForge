import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleCheck, Clock3, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import DashboardWorkbench from "@/components/dashboard/DashboardWorkbench";
import { demoAssets, demoFindings, demoIdentity } from "@/lib/demo/fixtures";

export default async function AssetDetailPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const asset = demoAssets.find(item => item.id === assetId);
  if (!asset) notFound();
  const findings = demoFindings.filter(item => item.asset_id === asset.id);
  const verified = asset.verification_status === "verified";
  return <AppShell {...demoIdentity}>
    <Link className="backLink" href="/dashboard/assets"><ArrowLeft size={14} /> Assets</Link>
    <section className="pageHeader assetPageHeader">
      <div><span className="sectionEyebrow">Asset control · Demo</span><h1>{asset.name}</h1><p>{asset.canonical_target}</p></div>
      <span className={`controlBadge ${verified ? "verified" : "unverified"}`}>{verified ? <CircleCheck size={15} /> : <Clock3 size={15} />}{verified ? "Control verified · Sample" : "Awaiting verification"}</span>
    </section>
    <section className="assetDetailGrid">
      <article className="panel"><div className="panelTitle"><div><span>Control status</span><h2>Authorization boundary</h2></div></div>
        <dl className="detailList"><div><dt>Asset type</dt><dd>{asset.kind.replaceAll("_", " ")}</dd></div><div><dt>Hostname</dt><dd>{new URL(asset.canonical_target).hostname}</dd></div><div><dt>Verification</dt><dd>{verified ? "Verified (simulated)" : "Unverified"}</dd></div><div><dt>Sample verification date</dt><dd>{asset.verified_at ? "8 September 2026" : "Proof required"}</dd></div></dl>
      </article>
      <article className="panel"><div className="panelTitle"><div><span>Portfolio demonstration</span><h2>Read-only security context</h2></div><ShieldCheck size={18} /></div><div className="guardrail"><ShieldCheck size={17} /><p>Verification is simulated for this sample asset. The reserved example target has not been verified or scanned. Explore the sample findings below; no remote testing or data changes run in this demo.</p></div></article>
    </section>
    <DashboardWorkbench assets={[asset]} findings={findings} totalFindings={findings.length} />
  </AppShell>;
}
