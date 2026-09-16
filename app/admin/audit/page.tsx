import type { Metadata } from "next";
import Link from "next/link";
import AdminPageHeader from "@/components/platform-admin/AdminPageHeader";
import { listPlatformAdminAuditEvents } from "@/lib/platform-admin/audit";

export const metadata: Metadata = { title: "Audit" };
export const dynamic = "force-dynamic";

function parsePage(value: string | undefined): number {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export default async function PlatformAdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageValue } = await searchParams;
  const result = await listPlatformAdminAuditEvents({ page: parsePage(pageValue), perPage: 50 });

  return (
    <>
      <AdminPageHeader
        eyebrow="Privileged evidence"
        title="Audit trail"
        description="Append-only operational evidence for platform administration actions, including actor, target, bounded reason, and bounded metadata."
      />

      <div className="adminTableWrap adminDesktopTable">
        <table className="adminTable">
          <thead><tr><th>Time</th><th>Action</th><th>Actor</th><th>Target</th><th>Reason</th><th>Metadata</th></tr></thead>
          <tbody>
            {result.events.map((event) => (
              <tr key={event.id}>
                <td>{new Date(event.createdAt).toLocaleString()}</td>
                <td><strong>{event.action}</strong></td>
                <td><Link className="adminCode" href={`/admin/users/${event.actorUserId}`}>{event.actorUserId}</Link></td>
                <td>
                  {event.targetUserId ? <><span>User </span><Link className="adminCode" href={`/admin/users/${event.targetUserId}`}>{event.targetUserId}</Link></> : null}
                  {event.targetWorkspaceId ? <><br /><span>Workspace </span><span className="adminCode">{event.targetWorkspaceId}</span></> : null}
                  {!event.targetUserId && !event.targetWorkspaceId ? <span className="adminMuted">Platform</span> : null}
                </td>
                <td>{event.reason}</td>
                <td><span className="adminCode">{JSON.stringify(event.metadata)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.events.length === 0 ? <div className="adminEmpty">No platform administration events have been recorded yet.</div> : null}
      </div>

      <div className="adminMobileCards" aria-label="Platform administration audit events">
        {result.events.map((event) => (
          <article className="adminMobileCard" key={event.id}>
            <div className="adminMobileCardHeader">
              <div>
                <span className="adminMobileCardEyebrow">Audit event</span>
                <h2>{event.action}</h2>
                <p>{new Date(event.createdAt).toLocaleString()}</p>
              </div>
              <span className="adminBadge">Recorded</span>
            </div>
            <div className="adminMobileCardGrid adminMobileCardGridSingle">
              <div className="adminMobileDatum"><span>Actor</span><Link className="adminCode" href={`/admin/users/${event.actorUserId}`}>{event.actorUserId}</Link></div>
              {event.targetUserId ? <div className="adminMobileDatum"><span>Target user</span><Link className="adminCode" href={`/admin/users/${event.targetUserId}`}>{event.targetUserId}</Link></div> : null}
              {event.targetWorkspaceId ? <div className="adminMobileDatum"><span>Target workspace</span><strong className="adminCode">{event.targetWorkspaceId}</strong></div> : null}
              {!event.targetUserId && !event.targetWorkspaceId ? <div className="adminMobileDatum"><span>Target</span><strong>Platform</strong></div> : null}
              <div className="adminMobileDatum"><span>Reason</span><strong>{event.reason}</strong></div>
              <div className="adminMobileDatum"><span>Metadata</span><strong className="adminCode">{JSON.stringify(event.metadata)}</strong></div>
            </div>
          </article>
        ))}
        {result.events.length === 0 ? <div className="adminEmpty adminMobileCard">No platform administration events have been recorded yet.</div> : null}
      </div>

      <nav className="adminPagination" aria-label="Audit pagination">
        <span>Page {result.page}</span>
        <span className="adminPaginationActions">
          {result.page > 1 ? <Link className="adminButton" href={`/admin/audit?page=${result.page - 1}`}>Previous</Link> : null}
          {result.hasNextPage ? <Link className="adminButton" href={`/admin/audit?page=${result.page + 1}`}>Next</Link> : null}
        </span>
      </nav>
    </>
  );
}
