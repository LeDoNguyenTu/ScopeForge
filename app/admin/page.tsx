import Link from "next/link";
import { Boxes, Bug, FolderKanban, ScanSearch, ShieldAlert, UserPlus, Users } from "lucide-react";
import { getPlatformStats } from "@/lib/platform-admin/stats";
import { getPlatformSettings } from "@/lib/platform-settings/server";

export const dynamic = "force-dynamic";

function number(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export default async function PlatformAdminOverviewPage() {
  const [stats, settings] = await Promise.all([
    getPlatformStats(),
    getPlatformSettings(),
  ]);

  const metrics = [
    ["Users", stats.totalUsers, `${stats.newUsers7d} joined in 7 days`, Users],
    ["Workspaces", stats.totalWorkspaces, "Tenant workspaces", FolderKanban],
    ["Assets", stats.totalAssets, `${stats.verifiedAssets} verified`, Boxes],
    ["Scans", stats.totalScans, `${stats.scans24h} created in 24 hours`, ScanSearch],
    ["Findings", stats.totalFindings, `${stats.activeFindings} active`, Bug],
    ["Critical", stats.criticalFindings, "Active critical findings", ShieldAlert],
    ["New users", stats.newUsers30d, "Created in 30 days", UserPlus],
  ] as const;

  return (
    <>
      <header className="adminPageHeader">
        <div>
          <span className="adminEyebrow">Platform control plane</span>
          <h1>Overview</h1>
          <p>Cross-workspace operational visibility for ScopeForge. Platform authority is isolated from tenant workspace roles and every privileged mutation is audited.</p>
        </div>
        <span className="adminBadge adminBadgeActive">Observed {new Date(stats.observedAt).toLocaleString()}</span>
      </header>

      <section className="adminMetricGrid" aria-label="Platform statistics">
        {metrics.map(([label, value, hint, Icon]) => (
          <article className="adminMetricCard" key={label}>
            <span>{label} <Icon size={15} /></span>
            <strong>{number(value)}</strong>
            <small>{hint}</small>
          </article>
        ))}
      </section>

      <section className="adminPanelGrid">
        <article className="adminPanel">
          <h2>Site controls</h2>
          <p>Current authoritative registration and maintenance state.</p>
          <div className="adminStatusRows">
            <div className="adminStatusRow"><span>New account registration</span><strong className={settings.registrationEnabled ? "adminStatusGood" : "adminStatusWarn"}>{settings.registrationEnabled ? "Open" : "Closed"}</strong></div>
            <div className="adminStatusRow"><span>Maintenance mode</span><strong className={settings.maintenanceMode ? "adminStatusWarn" : "adminStatusGood"}>{settings.maintenanceMode ? "Enabled" : "Disabled"}</strong></div>
            <div className="adminStatusRow"><span>Last settings update</span><strong>{new Date(settings.updatedAt).toLocaleString()}</strong></div>
          </div>
          <p className="adminSection"><Link className="adminButton" href="/admin/settings">Manage settings</Link></p>
        </article>

        <article className="adminPanel">
          <h2>Administrative boundaries</h2>
          <p>The web console deliberately exposes operational administration, not a raw database shell.</p>
          <div className="adminStatusRows">
            <div className="adminStatusRow"><span>Platform admin tables</span><strong className="adminStatusGood">Server only</strong></div>
            <div className="adminStatusRow"><span>Workspace roles imply platform access</span><strong className="adminStatusGood">No</strong></div>
            <div className="adminStatusRow"><span>Privileged action audit</span><strong className="adminStatusGood">Enabled</strong></div>
            <div className="adminStatusRow"><span>Raw SQL / service secret exposure</span><strong className="adminStatusGood">Not exposed</strong></div>
          </div>
        </article>
      </section>
    </>
  );
}
