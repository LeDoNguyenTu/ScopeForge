import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import AdminPageHeader from "@/components/platform-admin/AdminPageHeader";
import { listAdminWorkspaces } from "@/lib/platform-admin/workspaces";

export const metadata: Metadata = { title: "Workspaces" };
export const dynamic = "force-dynamic";

function parsePage(value: string | undefined): number {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function pageHref(page: number, query: string): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("page", String(page));
  return `/admin/workspaces?${params.toString()}`;
}

export default async function PlatformAdminWorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const result = await listAdminWorkspaces({ page: parsePage(params.page), perPage: 25, query });

  return (
    <>
      <AdminPageHeader
        eyebrow="Tenant visibility"
        title="Workspaces"
        description="Observe workspace ownership, members, registered scope, scans, and active findings across the platform. General workspace deletion is intentionally not exposed here."
      />

      <form className="adminSearch" method="get">
        <input name="q" defaultValue={query} maxLength={120} placeholder="Search workspace name, slug, ID, or creator ID" aria-label="Search workspaces" />
        <button className="adminButton adminButtonPrimary" type="submit"><Search size={15} /> Search</button>
      </form>

      <div className="adminTableWrap adminDesktopTable">
        <table className="adminTable">
          <thead><tr><th>Workspace</th><th>Creator</th><th>Members</th><th>Assets</th><th>Scans</th><th>Active findings</th><th>Recent activity</th></tr></thead>
          <tbody>
            {result.workspaces.map((workspace) => (
              <tr key={workspace.id}>
                <td><strong>{workspace.name}</strong><br /><span className="adminMuted">{workspace.slug}</span><br /><span className="adminCode">{workspace.id}</span></td>
                <td>{workspace.creatorDisplayName ?? "Unknown"}<br /><Link className="adminCode" href={`/admin/users/${workspace.createdByUserId}`}>{workspace.createdByUserId}</Link></td>
                <td>{workspace.memberCount}</td>
                <td>{workspace.assetCount}</td>
                <td>{workspace.scanCounts.total}<br /><span className="adminMuted">{workspace.scanCounts.running} running, {workspace.scanCounts.failed} failed</span></td>
                <td>{workspace.activeFindingCount}{workspace.criticalFindingCount > 0 ? <><br /><span className="adminBadge adminBadgeCritical">{workspace.criticalFindingCount} critical</span></> : null}</td>
                <td>{workspace.recentActivityAt ? new Date(workspace.recentActivityAt).toLocaleString() : "None"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.workspaces.length === 0 ? <div className="adminEmpty">No workspaces matched this query.</div> : null}
      </div>

      <div className="adminMobileCards" aria-label="Workspaces">
        {result.workspaces.map((workspace) => (
          <article className="adminMobileCard" key={workspace.id}>
            <div className="adminMobileCardHeader">
              <div>
                <span className="adminMobileCardEyebrow">Workspace</span>
                <h2>{workspace.name}</h2>
                <p>{workspace.slug}</p>
              </div>
              {workspace.criticalFindingCount > 0 ? <span className="adminBadge adminBadgeCritical">{workspace.criticalFindingCount} critical</span> : <span className="adminBadge adminBadgeActive">Healthy view</span>}
            </div>
            <div className="adminMobileCardGrid">
              <div className="adminMobileDatum"><span>Creator</span><strong>{workspace.creatorDisplayName ?? "Unknown"}</strong></div>
              <div className="adminMobileDatum"><span>Members</span><strong>{workspace.memberCount}</strong></div>
              <div className="adminMobileDatum"><span>Assets</span><strong>{workspace.assetCount}</strong></div>
              <div className="adminMobileDatum"><span>Scans</span><strong>{workspace.scanCounts.total}</strong><small>{workspace.scanCounts.running} running, {workspace.scanCounts.failed} failed</small></div>
              <div className="adminMobileDatum"><span>Active findings</span><strong>{workspace.activeFindingCount}</strong></div>
              <div className="adminMobileDatum"><span>Recent activity</span><strong>{workspace.recentActivityAt ? new Date(workspace.recentActivityAt).toLocaleString() : "None"}</strong></div>
            </div>
            <p className="adminCode adminMobileCode">{workspace.id}</p>
            <Link className="adminButton adminMobilePrimaryAction" href={`/admin/users/${workspace.createdByUserId}`}>View creator</Link>
          </article>
        ))}
        {result.workspaces.length === 0 ? <div className="adminEmpty adminMobileCard">No workspaces matched this query.</div> : null}
      </div>

      {result.searchTruncated ? <p className="adminMuted adminHelperText">Workspace discovery is bounded to the newest 250 workspaces. Narrow the query if needed.</p> : null}
      <nav className="adminPagination" aria-label="Workspace pagination">
        <span>Page {result.page}</span>
        <span className="adminPaginationActions">
          {result.page > 1 ? <Link className="adminButton" href={pageHref(result.page - 1, query)}>Previous</Link> : null}
          {result.hasNextPage ? <Link className="adminButton" href={pageHref(result.page + 1, query)}>Next</Link> : null}
        </span>
      </nav>
    </>
  );
}
