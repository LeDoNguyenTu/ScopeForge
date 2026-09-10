import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getPlatformSettings } from "@/lib/platform-settings/server";

export const metadata: Metadata = { title: "Maintenance" };
export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const settings = await getPlatformSettings();
  if (!settings.maintenanceMode) redirect("/");

  return (
    <main className="authPage">
      <section className="authCard" aria-labelledby="maintenance-title">
        <p className="eyebrow"><ShieldCheck size={18} /> ScopeForge maintenance</p>
        <h1 id="maintenance-title">The security workspace is temporarily unavailable.</h1>
        <p>{settings.maintenanceMessage}</p>
        <p>Authentication and platform administration remain available during maintenance.</p>
        <div className="buttonRow">
          <Link className="button primaryButton" href="/auth/sign-in">Sign in</Link>
          <Link className="button" href="/admin">Admin console</Link>
        </div>
      </section>
    </main>
  );
}
