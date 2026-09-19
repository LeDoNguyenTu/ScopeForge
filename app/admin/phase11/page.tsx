import type { Metadata } from "next";
import AdminPageHeader from "@/components/platform-admin/AdminPageHeader";
import Phase11CanaryForm from "@/components/platform-admin/Phase11CanaryForm";
import { listPhase11CanaryAssets } from "@/lib/platform-admin/phase11-operations";

export const metadata: Metadata = { title: "Phase 11 operations" };
export const dynamic = "force-dynamic";

export default async function Phase11OperationsPage() {
  const assets = await listPhase11CanaryAssets();
  return (
    <>
      <AdminPageHeader
        eyebrow="Controlled execution"
        title="Phase 11 operations"
        description="Run the release canary against an existing verified target. The server rechecks platform authority, workspace ownership or administration, target verification, and the fixed execution budget before queuing work."
      />
      <section className="adminPanelGrid">
        <article className="adminPanel adminPanelPrimary">
          <div className="adminPanelHeading">
            <div>
              <span className="adminPanelKicker">HTTP discovery</span>
              <h2>Bounded production canary</h2>
            </div>
            <span className="adminBadge adminBadgeActive">Safe active</span>
          </div>
          <Phase11CanaryForm assets={assets} />
        </article>
        <article className="adminPanel">
          <div className="adminPanelHeading">
            <div>
              <span className="adminPanelKicker">Fixed boundary</span>
              <h2>Enforced limits</h2>
            </div>
          </div>
          <div className="adminStatusRows">
            <div className="adminStatusRow"><span>Target authority</span><strong className="adminStatusGood">Verified asset only</strong></div>
            <div className="adminStatusRow"><span>HTTP route</span><strong>Root only</strong></div>
            <div className="adminStatusRow"><span>Method</span><strong>GET</strong></div>
            <div className="adminStatusRow"><span>Redirects</span><strong>Disabled</strong></div>
            <div className="adminStatusRow"><span>Request ceiling</span><strong>1</strong></div>
            <div className="adminStatusRow"><span>Runtime ceiling</span><strong>5 seconds</strong></div>
          </div>
        </article>
      </section>
    </>
  );
}
