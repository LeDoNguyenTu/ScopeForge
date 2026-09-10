import type { Metadata } from "next";
import PlatformSettingsForm from "@/components/platform-admin/PlatformSettingsForm";
import { getPlatformSettings } from "@/lib/platform-settings/server";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function PlatformAdminSettingsPage() {
  const settings = await getPlatformSettings();

  return (
    <>
      <header className="adminPageHeader">
        <div>
          <span className="adminEyebrow">Site controls</span>
          <h1>Settings</h1>
          <p>Control ScopeForge registration and maintenance state without opening Supabase. These are bounded operational controls, not arbitrary database or provider administration.</p>
        </div>
      </header>

      <section className="adminPanel">
        <h2>Platform availability</h2>
        <p>Every change requires a reason and is written to the platform administration audit trail.</p>
        <PlatformSettingsForm settings={settings} />
      </section>

      <section className="adminPanel adminSection">
        <h2>External provider controls</h2>
        <p>Vercel environment variables, Cloudflare WAF and Turnstile configuration, and Supabase project-level security switches remain provider-owned state until a supported management integration is intentionally added. ScopeForge does not expose provider credentials through this page.</p>
      </section>
    </>
  );
}
