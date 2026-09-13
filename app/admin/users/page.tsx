import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Search, UserRound } from "lucide-react";
import AdminPageHeader from "@/components/platform-admin/AdminPageHeader";
import { listPlatformUsers } from "@/lib/platform-admin/users";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

function parsePage(value: string | undefined): number {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function pageHref(page: number, query: string): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("page", String(page));
  return `/admin/users?${params.toString()}`;
}

function timestamp(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "Never";
}

export default async function PlatformAdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const page = parsePage(params.page);
  const result = await listPlatformUsers({ page, perPage: 25, query });

  return (
    <>
      <AdminPageHeader
        eyebrow="Identity administration"
        title="Users"
        description="Inspect account state, workspace membership, sign-in activity, and protected platform roles. Suspensions and deletions are re-authorized server-side."
      />

      <form className="adminSearch" method="get">
        <input name="q" defaultValue={query} maxLength={120} placeholder="Search email, name, or user ID" aria-label="Search users" />
        <button className="adminButton adminButtonPrimary" type="submit"><Search size={15} /> Search</button>
      </form>

      <div className="adminTableWrap adminDesktopTable">
        <table className="adminTable">
          <thead>
            <tr><th>User</th><th>Status</th><th>Platform role</th><th>Workspaces</th><th>Created</th><th>Last sign-in</th></tr>
          </thead>
          <tbody>
            {result.users.map((user) => (
              <tr key={user.id}>
                <td>
                  <Link href={`/admin/users/${user.id}`}><strong>{user.displayName}</strong></Link><br />
                  <span className="adminMuted">{user.email ?? "No email"}</span><br />
                  <span className="adminCode">{user.id}</span>
                </td>
                <td><span className={`adminBadge ${user.status === "suspended" ? "adminBadgeSuspended" : user.status === "active" ? "adminBadgeActive" : ""}`}>{user.status}</span></td>
                <td>{user.platformRole ? <span className="adminBadge adminBadgeActive">{user.platformRole}</span> : <span className="adminMuted">User</span>}</td>
                <td>{user.workspaceCount}</td>
                <td>{timestamp(user.createdAt)}</td>
                <td>{timestamp(user.lastSignInAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.users.length === 0 ? <div className="adminEmpty"><UserRound size={22} /><p>No users matched this query.</p></div> : null}
      </div>

      <div className="adminMobileCards" aria-label="Users">
        {result.users.map((user) => (
          <article className="adminMobileCard" key={user.id}>
            <div className="adminMobileCardHeader">
              <div>
                <span className="adminMobileCardEyebrow">User account</span>
                <h2>{user.displayName}</h2>
                <p>{user.email ?? "No email"}</p>
              </div>
              <span className={`adminBadge ${user.status === "suspended" ? "adminBadgeSuspended" : user.status === "active" ? "adminBadgeActive" : ""}`}>{user.status}</span>
            </div>
            <div className="adminMobileCardGrid">
              <div className="adminMobileDatum"><span>Platform role</span><strong>{user.platformRole ?? "User"}</strong></div>
              <div className="adminMobileDatum"><span>Workspaces</span><strong>{user.workspaceCount}</strong></div>
              <div className="adminMobileDatum"><span>Created</span><strong>{timestamp(user.createdAt)}</strong></div>
              <div className="adminMobileDatum"><span>Last sign-in</span><strong>{timestamp(user.lastSignInAt)}</strong></div>
            </div>
            <p className="adminCode adminMobileCode">{user.id}</p>
            <Link className="adminButton adminMobilePrimaryAction" href={`/admin/users/${user.id}`}>View user <ArrowRight size={14} /></Link>
          </article>
        ))}
        {result.users.length === 0 ? <div className="adminEmpty adminMobileCard"><UserRound size={22} /><p>No users matched this query.</p></div> : null}
      </div>

      {result.searchTruncated ? <p className="adminMuted adminHelperText">Search is bounded to the first 1,000 Auth users. Narrow the query if needed.</p> : null}
      <nav className="adminPagination" aria-label="User pagination">
        <span>{result.totalMatches === null ? `Page ${result.page}` : `${result.totalMatches} matching user${result.totalMatches === 1 ? "" : "s"}`}</span>
        <span className="adminPaginationActions">
          {result.page > 1 ? <Link className="adminButton" href={pageHref(result.page - 1, query)}>Previous</Link> : null}
          {result.hasNextPage ? <Link className="adminButton" href={pageHref(result.page + 1, query)}>Next</Link> : null}
        </span>
      </nav>
    </>
  );
}
