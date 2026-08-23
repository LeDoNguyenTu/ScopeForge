import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AppShell from "@/components/AppShell";
import AssetForm from "@/components/assets/AssetForm";
import { getDashboardContext } from "@/lib/workspaces/current";

export const dynamic = "force-dynamic";

export default async function NewAssetPage() {
  const { workspace, role, displayName } = await getDashboardContext();

  return (
    <AppShell displayName={displayName} workspaceName={workspace.name} role={role}>
      <Link className="backLink" href="/dashboard/assets"><ArrowLeft size={14} /> Assets</Link>
      <section className="pageHeader assetPageHeader">
        <div><span className="sectionEyebrow">Add to authorized scope</span><h1>Register an asset</h1><p>ScopeForge records the target first. Web and API assets must prove control before any later remote security testing can be enabled.</p></div>
      </section>
      <div className="formLayout">
        <AssetForm />
        <aside className="panel safetyAside">
          <span className="sectionEyebrow">Why this matters</span>
          <h2>Scope before scan.</h2>
          <p>A registered URL is not permission to attack it. ScopeForge separates target registration, proof of control, and later scan execution so each boundary is explicit and auditable.</p>
          <div className="miniSteps">
            <div><span>1</span><p><strong>Register</strong> the target.</p></div>
            <div><span>2</span><p><strong>Verify</strong> control using a fixed well-known file.</p></div>
            <div><span>3</span><p><strong>Enable testing later</strong> only when scanner safety controls ship.</p></div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
