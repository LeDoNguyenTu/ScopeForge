import Link from "next/link";
import { notFound } from "next/navigation";
import { Boxes, Bug, FolderKanban, ScanSearch, ShieldAlert, Users } from "lucide-react";
import AdminMetricCard from "@/components/platform-admin/AdminMetricCard";
import AdminNavigation from "@/components/platform-admin/AdminNavigation";
import AdminPageHeader from "@/components/platform-admin/AdminPageHeader";
import PlatformSettingsForm from "@/components/platform-admin/PlatformSettingsForm";
import GitHubRepositoryPicker from "@/components/integrations/GitHubRepositoryPicker";
import type { GitHubRepositorySummary } from "@/lib/github-app/types";
import "../../admin/admin.css";
import "../../admin/admin-responsive.css";
import "../../admin/admin-settings.css";
import "../../dashboard/integrations/github/github-integration.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin design preview", robots: { index: false, follow: false } };

const views = ["overview", "users", "workspaces", "audit", "settings", "github"] as const;
type PreviewView = (typeof views)[number];

function normalizeView(value: string | undefined): PreviewView {
  return views.includes(value as PreviewView) ? (value as PreviewView) : "overview";
}

function PreviewNotice({ view }: { view: PreviewView }) {
  return (
    <div className="saasPreviewNotice adminPreviewNotice">
      <span><strong>Design preview</strong> · Sample data. Real administration still requires sign-in.</span>
      <nav aria-label="Admin design preview states">
        {views.map((item) => (
          <Link key={item} href={`/preview/admin?view=${item}`} aria-current={view === item ? "page" : undefined}>{item}</Link>
        ))}
      </nav>
    </div>
  );
}

function OverviewPreview() {
  const metrics = [
    ["Users", "1,248", "42 joined in 7 days", Users],
    ["Workspaces", "316", "Tenant workspaces", FolderKanban],
    ["Assets", "4,892", "4,201 verified", Boxes],
    ["Scans", "12,480", "184 created in 24 hours", ScanSearch],
    ["Findings", "928", "286 active", Bug],
    ["Critical", "17", "Active critical findings", ShieldAlert],
  ] as const;

  return (
    <>
      <AdminPageHeader
        eyebrow="Platform control plane"
        title="Overview"
        description="Synthetic cross-workspace operational visibility used only to validate the responsive control-plane composition."
        actions={<span className="adminBadge adminBadgeActive">Preview state</span>}
      />
      <section className="adminMetricGrid" aria-label="Sample platform statistics">
        {metrics.map(([label, value, hint, icon]) => <AdminMetricCard key={label} label={label} value={value} hint={hint} icon={icon} />)}
      </section>
      <section className="adminPanelGrid">
        <article className="adminPanel adminPanelPrimary">
          <div className="adminPanelHeading"><div><span className="adminPanelKicker">Availability</span><h2>Site controls</h2></div><button className="adminButton" type="button" disabled>Manage settings</button></div>
          <p>Representative platform availability state.</p>
          <div className="adminStatusRows">
            <div className="adminStatusRow"><span>New account registration</span><strong className="adminStatusGood">Open</strong></div>
            <div className="adminStatusRow"><span>Maintenance mode</span><strong className="adminStatusGood">Disabled</strong></div>
            <div className="adminStatusRow"><span>Last settings update</span><strong>13 Sep 2026, 09:00</strong></div>
          </div>
        </article>
        <article className="adminPanel">
          <div className="adminPanelHeading"><div><span className="adminPanelKicker">Security model</span><h2>Administrative boundaries</h2></div></div>
          <p>Representative security-boundary status.</p>
          <div className="adminStatusRows">
            <div className="adminStatusRow"><span>Platform admin tables</span><strong className="adminStatusGood">Server only</strong></div>
            <div className="adminStatusRow"><span>Privileged action audit</span><strong className="adminStatusGood">Enabled</strong></div>
            <div className="adminStatusRow"><span>Raw service secret exposure</span><strong className="adminStatusGood">Not exposed</strong></div>
          </div>
        </article>
      </section>
    </>
  );
}

const sampleUsers = [
  { id: "6c507ba4-5af4-4f69-bc2e-65d219a51810", name: "Alex Rivera", email: "alex@example.invalid", status: "active", role: "User", workspaces: 2, created: "12 Sep 2026", signIn: "13 Sep 2026, 08:42" },
  { id: "187d2971-a8cb-43f2-a55c-455508f6a1a9", name: "Morgan Chen", email: "morgan.security.team+long-address@example.invalid", status: "suspended", role: "Admin", workspaces: 6, created: "3 Sep 2026", signIn: "11 Sep 2026, 19:15" },
];

function UsersPreview() {
  return (
    <>
      <AdminPageHeader eyebrow="Identity administration" title="Users" description="Sample account records for responsive visual acceptance." />
      <div className="adminTableWrap adminDesktopTable"><table className="adminTable"><thead><tr><th>User</th><th>Status</th><th>Role</th><th>Workspaces</th><th>Last sign-in</th></tr></thead><tbody>{sampleUsers.map((user) => <tr key={user.id}><td><strong>{user.name}</strong><br /><span className="adminMuted">{user.email}</span><br /><span className="adminCode">{user.id}</span></td><td><span className={`adminBadge ${user.status === "active" ? "adminBadgeActive" : "adminBadgeSuspended"}`}>{user.status}</span></td><td>{user.role}</td><td>{user.workspaces}</td><td>{user.signIn}</td></tr>)}</tbody></table></div>
      <div className="adminMobileCards" aria-label="Sample users">{sampleUsers.map((user) => <article className="adminMobileCard" key={user.id}><div className="adminMobileCardHeader"><div><span className="adminMobileCardEyebrow">User account</span><h2>{user.name}</h2><p>{user.email}</p></div><span className={`adminBadge ${user.status === "active" ? "adminBadgeActive" : "adminBadgeSuspended"}`}>{user.status}</span></div><div className="adminMobileCardGrid"><div className="adminMobileDatum"><span>Platform role</span><strong>{user.role}</strong></div><div className="adminMobileDatum"><span>Workspaces</span><strong>{user.workspaces}</strong></div><div className="adminMobileDatum"><span>Created</span><strong>{user.created}</strong></div><div className="adminMobileDatum"><span>Last sign-in</span><strong>{user.signIn}</strong></div></div><p className="adminCode adminMobileCode">{user.id}</p><button className="adminButton adminMobilePrimaryAction" type="button" disabled>View user</button></article>)}</div>
    </>
  );
}

function WorkspacesPreview() {
  const rows = [
    ["Production Security", "production-security", "8", "24", "184", "12", "2 critical"],
    ["Developer Lab With A Deliberately Long Workspace Name", "developer-lab-long-workspace-slug", "3", "11", "73", "4", "0 critical"],
  ];
  return (
    <>
      <AdminPageHeader eyebrow="Tenant visibility" title="Workspaces" description="Sample tenant records for responsive visual acceptance." />
      <div className="adminTableWrap adminDesktopTable"><table className="adminTable"><thead><tr><th>Workspace</th><th>Members</th><th>Assets</th><th>Scans</th><th>Findings</th><th>Critical</th></tr></thead><tbody>{rows.map((row) => <tr key={row[1]}><td><strong>{row[0]}</strong><br /><span className="adminMuted">{row[1]}</span></td><td>{row[2]}</td><td>{row[3]}</td><td>{row[4]}</td><td>{row[5]}</td><td>{row[6]}</td></tr>)}</tbody></table></div>
      <div className="adminMobileCards" aria-label="Sample workspaces">{rows.map((row) => <article className="adminMobileCard" key={row[1]}><div className="adminMobileCardHeader"><div><span className="adminMobileCardEyebrow">Workspace</span><h2>{row[0]}</h2><p>{row[1]}</p></div><span className="adminBadge adminBadgeActive">Observed</span></div><div className="adminMobileCardGrid"><div className="adminMobileDatum"><span>Members</span><strong>{row[2]}</strong></div><div className="adminMobileDatum"><span>Assets</span><strong>{row[3]}</strong></div><div className="adminMobileDatum"><span>Scans</span><strong>{row[4]}</strong></div><div className="adminMobileDatum"><span>Active findings</span><strong>{row[5]}</strong><small>{row[6]}</small></div></div></article>)}</div>
    </>
  );
}

function AuditPreview() {
  const events = [
    ["user.suspended", "13 Sep 2026, 08:51", "6c507ba4-5af4-4f69-bc2e-65d219a51810", "Repeated abuse response review"],
    ["platform.settings.updated", "13 Sep 2026, 08:43", "187d2971-a8cb-43f2-a55c-455508f6a1a9", "Scheduled availability update"],
  ];
  return (
    <>
      <AdminPageHeader eyebrow="Privileged evidence" title="Audit trail" description="Sample privileged events for responsive visual acceptance." />
      <div className="adminTableWrap adminDesktopTable"><table className="adminTable"><thead><tr><th>Time</th><th>Action</th><th>Actor</th><th>Reason</th></tr></thead><tbody>{events.map((event) => <tr key={event[0]}><td>{event[1]}</td><td><strong>{event[0]}</strong></td><td className="adminCode">{event[2]}</td><td>{event[3]}</td></tr>)}</tbody></table></div>
      <div className="adminMobileCards" aria-label="Sample audit events">{events.map((event) => <article className="adminMobileCard" key={event[0]}><div className="adminMobileCardHeader"><div><span className="adminMobileCardEyebrow">Audit event</span><h2>{event[0]}</h2><p>{event[1]}</p></div><span className="adminBadge">Recorded</span></div><div className="adminMobileCardGrid adminMobileCardGridSingle"><div className="adminMobileDatum"><span>Actor</span><strong className="adminCode">{event[2]}</strong></div><div className="adminMobileDatum"><span>Reason</span><strong>{event[3]}</strong></div></div></article>)}</div>
    </>
  );
}

function SettingsPreview() {
  return (
    <>
      <AdminPageHeader eyebrow="Site controls" title="Settings" description="Sample platform settings used only to validate responsive form composition." />
      <div className="adminSettingsGrid">
        <section className="adminPanel adminSettingsPrimary"><div className="adminPanelHeading"><div><span className="adminPanelKicker">Authoritative platform state</span><h2>Platform availability</h2></div></div><PlatformSettingsForm settings={{ registrationEnabled: true, maintenanceMode: false, maintenanceMessage: "ScopeForge is undergoing scheduled maintenance.", updatedAt: "2026-09-13T00:00:00Z", updatedBy: null }} /></section>
        <aside className="adminSettingsSide"><section className="adminPanel"><span className="adminPanelKicker">External state</span><h2>Provider-owned controls</h2><p>Secrets remain provider-owned and are never displayed here.</p></section><section className="adminPanel adminDangerPanel"><span className="adminPanelKicker">Operational caution</span><h2>Maintenance changes affect every tenant</h2><p>Representative danger-zone treatment.</p></section></aside>
      </div>
    </>
  );
}

const sampleRepositories: GitHubRepositorySummary[] = [
  { id: 1, ownerLogin: "LeDoNguyenTu", name: "ScopeForge", fullName: "LeDoNguyenTu/ScopeForge", defaultBranch: "main", isPrivate: false, htmlUrl: "https://github.com/LeDoNguyenTu/ScopeForge" },
  { id: 2, ownerLogin: "example-enterprise", name: "private-security-platform-with-a-very-long-name", fullName: "example-enterprise/private-security-platform-with-a-very-long-name", defaultBranch: "feature/long-default-branch-name-for-mobile-validation", isPrivate: true, htmlUrl: "https://example.invalid/private" },
];

function GitHubPreview() {
  return (
    <div className="githubIntegrationPage">
      <section className="githubIntegrationHeader"><div><span className="sectionEyebrow">Connected projects</span><h1>GitHub repositories</h1><p>Sample installation and repository state for responsive visual acceptance.</p></div><span className="statusPill githubConnectedPill">Connected</span></section>
      <section className="githubConnectionBanner"><span className="githubConnectionIcon">GH</span><div><span className="githubConnectionKicker">Installation state</span><h2>Repository access verified</h2><p>Sample read-only installation state.</p></div><span className="githubConnectionStatus">Read-only</span></section>
      <section className="githubRepositorySection"><div className="githubRepositorySectionHeader"><div><span className="sectionEyebrow">Installation repositories</span><h2>Import from GitHub</h2><p>Buttons are present for layout validation; real actions still require normal authorization.</p></div></div><GitHubRepositoryPicker repositories={sampleRepositories} page={1} hasNextPage /></section>
    </div>
  );
}

function PreviewContent({ view }: { view: PreviewView }) {
  switch (view) {
    case "users": return <UsersPreview />;
    case "workspaces": return <WorkspacesPreview />;
    case "audit": return <AuditPreview />;
    case "settings": return <SettingsPreview />;
    case "github": return <GitHubPreview />;
    default: return <OverviewPreview />;
  }
}

export default async function AdminPreview({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (process.env.VERCEL_ENV !== "preview" && process.env.NODE_ENV !== "development") notFound();
  const view = normalizeView((await searchParams).view);

  return (
    <div className="platformAdminShell adminPreviewShell">
      <AdminNavigation email="preview.admin@example.invalid" role="owner" />
      <main className="platformAdminMain" id="platform-admin-content">
        <PreviewNotice view={view} />
        <PreviewContent view={view} />
      </main>
    </div>
  );
}
