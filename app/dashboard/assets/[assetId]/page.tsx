import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, CircleCheck, Clock3, FileClock, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import VerificationPanel from "@/components/assets/VerificationPanel";
import { getDashboardContext } from "@/lib/workspaces/current";

export const dynamic = "force-dynamic";

export default async function AssetDetailPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const { supabase, workspace, role, displayName } = await getDashboardContext();

  const [{ data: asset, error }, { data: events }] = await Promise.all([
    supabase
      .from("assets")
      .select("id,name,kind,canonical_target,hostname,verification_status,verified_at,created_at")
      .eq("id", assetId)
      .eq("workspace_id", workspace.id)
      .maybeSingle(),
    supabase
      .from("audit_events")
      .select("id,event_type,created_at,metadata")
      .eq("workspace_id", workspace.id)
      .eq("target_id", assetId)
      .order("created_at", { ascending: false })
      .limit(8)
  ]);

  if (error) throw new Error(error.message);
  if (!asset) notFound();

  const isVerified = asset.verification_status === "verified";

  return (
    <AppShell displayName={displayName} workspaceName={workspace.name} role={role}>
      <Link className="backLink" href="/dashboard/assets"><ArrowLeft size={14} /> Assets</Link>
      <section className="pageHeader assetPageHeader">
        <div><span className="sectionEyebrow">Asset control</span><h1>{asset.name}</h1><p>{asset.canonical_target}</p></div>
        <span className={`controlBadge ${isVerified ? "verified" : "unverified"}`}>{isVerified ? <CircleCheck size={15} /> : <Clock3 size={15} />}{isVerified ? "Control verified" : asset.verification_status.replaceAll("_", " ")}</span>
      </section>

      <section className="assetDetailGrid">
        <article className="panel">
          <div className="panelTitle"><div><span>Control status</span><h2>Authorization boundary</h2></div></div>
          <dl className="detailList">
            <div><dt>Asset type</dt><dd>{asset.kind.replaceAll("_", " ")}</dd></div>
            <div><dt>Hostname</dt><dd>{asset.hostname ?? "Not applicable"}</dd></div>
            <div><dt>Verification</dt><dd>{asset.verification_status.replaceAll("_", " ")}</dd></div>
            <div><dt>Verified at</dt><dd>{asset.verified_at ? new Date(asset.verified_at).toLocaleString() : "Not yet verified"}</dd></div>
          </dl>
        </article>
        <article className="panel">
          <div className="panelTitle"><div><span>Security testing</span><h2>Execution state</h2></div><Ban size={18} /></div>
          <div className="guardrail"><ShieldCheck size={17} /><p><strong>Not enabled in Phase 2.</strong> Verification establishes a safety prerequisite only. No DAST, fuzzing, exploitation, or background scanning starts from this page.</p></div>
        </article>
      </section>

      <section className="panel verificationSection">
        <VerificationPanel assetId={asset.id} status={asset.verification_status} kind={asset.kind} />
      </section>

      <section className="panel assetPanel">
        <div className="panelTitle"><div><span>Audit activity</span><h2>Recent security-control events</h2></div><FileClock size={18} /></div>
        {!events?.length ? <div className="emptyCompact">No asset audit events have been recorded yet.</div> : <div className="auditList">
          {events.map((event) => <div className="auditRow" key={event.id}><span className="auditDot" /><div><strong>{event.event_type.replaceAll(".", " ")}</strong><small>{new Date(event.created_at).toLocaleString()}</small></div></div>)}
        </div>}
      </section>
    </AppShell>
  );
}
