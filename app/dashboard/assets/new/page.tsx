import Link from "next/link";
import { ArrowLeft, ArrowRight, Github } from "lucide-react";
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
        <div><span className="sectionEyebrow">Add to authorized scope</span><h1>Register an asset</h1><p>Connect repositories through GitHub for verified project identity, or register web and API targets manually and prove control before remote testing.</p></div>
      </section>

      <section className="panel">
        <div className="panelTitle">
          <div>
            <span>Recommended for repositories</span>
            <h2>Import from GitHub</h2>
          </div>
          <Github size={20} aria-hidden="true" />
        </div>
        <p>Use the read-only ScopeForge GitHub App to select a repository from an installation you control. ScopeForge revalidates repository identity server-side before marking the project verified.</p>
        <Link className="primaryButton compact" href="/dashboard/integrations/github">
          Import from GitHub <ArrowRight size={15} />
        </Link>
      </section>

      <div className="formLayout">
        <AssetForm />
        <aside className="panel safetyAside">
          <span className="sectionEyebrow">Manual web and API path</span>
          <h2>Scope before scan.</h2>
          <p>A registered URL is not permission to attack it. ScopeForge separates target registration, proof of control, and later scan execution so each boundary is explicit and auditable.</p>
          <div className="miniSteps">
            <div><span>1</span><p><strong>Register</strong> the target.</p></div>
            <div><span>2</span><p><strong>Verify</strong> web or API control using a fixed well-known file.</p></div>
            <div><span>3</span><p><strong>Enable testing later</strong> only through the applicable scanner safety controls.</p></div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
