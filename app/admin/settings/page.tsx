import type { Metadata } from "next";
import { CloudCog, ShieldAlert, SlidersHorizontal } from "lucide-react";
import AdminPageHeader from "@/components/platform-admin/AdminPageHeader";
import PlatformSettingsForm from "@/components/platform-admin/PlatformSettingsForm";
import { getPlatformSettings } from "@/lib/platform-settings/server";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function PlatformAdminSettingsPage() {
  const settings = await getPlatformSettings();

  return (
    <>
      <AdminPageHeader
        eyebrow="Site controls"
        title="Settings"
        description="Control ScopeForge registration and maintenance state without opening Supabase. These are bounded operational controls, not arbitrary database or provider administration."
      />

      <div className="adminSettingsGrid">
        <section className="adminPanel adminSettingsPrimary">
          <div className="adminPanelHeading">
            <div className="adminSettingsHeading">
              <span className="adminSettingsIcon"><SlidersHorizontal size={17} /></span>
              <div>
                <span className="adminPanelKicker">Authoritative platform state</span>
                <h2>Platform availability</h2>
              </div>
            </div>
          </div>
          <p>Every change requires a reason and is written to the platform administration audit trail.</p>
          <PlatformSettingsForm settings={settings} />
        </section>

        <aside className="adminSettingsSide">
          <section className="adminPanel">
            <div className="adminSettingsHeading">
              <span className="adminSettingsIcon"><CloudCog size={17} /></span>
              <div>
                <span className="adminPanelKicker">External state</span>
                <h2>Provider-owned controls</h2>
              </div>
            </div>
            <p>Vercel environment variables, Cloudflare WAF and Turnstile configuration, and Supabase project-level security switches remain provider-owned state until a supported management integration is intentionally added.</p>
            <div className="adminStatusRows">
              <div className="adminStatusRow"><span>Provider credentials</span><strong className="adminStatusGood">Never exposed</strong></div>
              <div className="adminStatusRow"><span>Raw database administration</span><strong className="adminStatusGood">Not available</strong></div>
            </div>
          </section>

          <section className="adminPanel adminDangerPanel">
            <div className="adminSettingsHeading">
              <span className="adminSettingsIcon adminSettingsIconRisk"><ShieldAlert size={17} /></span>
              <div>
                <span className="adminPanelKicker">Operational caution</span>
                <h2>Maintenance changes affect every tenant</h2>
              </div>
            </div>
            <p>Use maintenance mode only when platform-wide interruption is intentional. Authentication, admin, API and trusted worker routes retain their existing server-side exceptions.</p>
          </section>
        </aside>
      </div>
    </>
  );
}
