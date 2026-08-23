import Link from "next/link";
import { ArrowRight, Boxes, CircleCheck, CircleDashed, Plus, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import { getDashboardContext } from "@/lib/workspaces/current";

export const dynamic = "force-dynamic";

function statusLabel(status: string) {
  if (status === "verified") return "Verified";
  if (status === "pending") return "Verification pending";
  if (status === "failed") return "Verification failed";
  return "Not verified";
}

export default async function AssetsPage() {
  const { supabase, workspace, role, displayName } = await getDashboardContext();
  const { data: assets, error } = await supabase
    .from("assets")
    .select("id,name,kind,canonical_target,verification_status,verified_at,created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const verifiedCount = (assets ?? []).filter((asset) => asset.verification_status === "verified").length;

  return (
    <AppShell displayName={displayName} workspaceName={workspace.name} role={role}>
      <section className="pageHeader">
        <div><span className="sectionEyebrow">Authorized scope</span><h1>Assets</h1><p>Register the applications and repositories your workspace is responsible for. Remote security testing remains locked until the target proves control.</p></div>
        <Link className="primaryButton compact" href="/dashboard/assets/new"><Plus size={15} /> Register asset</Link>
      </section>

      <section className="grid4 assetSummaryGrid">
        <article className="statCard"><div><span>Registered</span><Boxes size={18} /></div><strong>{assets?.length ?? 0}</strong><small>Trial limit: 10 per workspace</small></article>
        <article className="statCard"><div><span>Verified</span><CircleCheck size={18} /></div><strong>{verifiedCount}</strong><small>Proof of control confirmed</small></article>
        <article className="statCard"><div><span>Awaiting proof</span><CircleDashed size={18} /></div><strong>{(assets?.length ?? 0) - verifiedCount}</strong><small>No scan starts automatically</small></article>
        <article className="statCard"><div><span>Safety boundary</span><ShieldCheck size={18} /></div><strong>ON</strong><small>Active scanning disabled</small></article>
      </section>

      <section className="panel assetPanel">
        <div className="panelTitle"><div><span>Workspace inventory</span><h2>Registered targets</h2></div></div>
        {!assets?.length ? (
          <div className="emptyState">
            <span className="emptyIcon"><ShieldCheck size={23} /></span>
            <h3>Start with an asset you control</h3>
            <p>Target verification protects both your infrastructure and the wider Internet by preventing ScopeForge from becoming an arbitrary scanning proxy.</p>
            <Link className="primaryButton compact" href="/dashboard/assets/new">Register your first asset <ArrowRight size={15} /></Link>
          </div>
        ) : (
          <div className="assetList">
            {assets.map((asset) => (
              <Link className="assetRow" href={`/dashboard/assets/${asset.id}`} key={asset.id}>
                <span className={`assetStatusDot ${asset.verification_status}`} aria-hidden="true" />
                <div className="assetMain"><strong>{asset.name}</strong><span>{asset.canonical_target}</span></div>
                <span className="assetKind">{asset.kind.replaceAll("_", " ")}</span>
                <div className="assetState"><strong>{statusLabel(asset.verification_status)}</strong><small>{asset.verified_at ? `Verified ${new Date(asset.verified_at).toLocaleDateString()}` : "Proof required"}</small></div>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
