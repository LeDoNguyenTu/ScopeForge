import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdminPageHeader from "@/components/platform-admin/AdminPageHeader";
import UserAdminControls from "@/components/platform-admin/UserAdminControls";
import { requirePlatformAdmin } from "@/lib/platform-admin/authorization";
import { PlatformAdminReadError, getPlatformUser } from "@/lib/platform-admin/users";

export const metadata: Metadata = { title: "User details" };
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function timestamp(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "Never";
}

export default async function PlatformAdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  if (!UUID_PATTERN.test(userId)) notFound();

  const context = await requirePlatformAdmin();
  let detail;
  try {
    detail = await getPlatformUser(userId);
  } catch (error) {
    if (error instanceof PlatformAdminReadError && error.code === "PLATFORM_ADMIN_USER_NOT_FOUND") notFound();
    throw error;
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="User administration"
        title={detail.user.displayName}
        description={detail.user.email ?? "No email address"}
        actions={<Link className="adminButton" href="/admin/users">Back to users</Link>}
      />

      <div className="adminDetailGrid">
        <section className="adminPanel">
          <h2>Account</h2>
          <dl className="adminDefinitionList">
            <div><dt>User ID</dt><dd className="adminCode">{detail.user.id}</dd></div>
            <div><dt>Status</dt><dd><span className={`adminBadge ${detail.user.status === "suspended" ? "adminBadgeSuspended" : detail.user.status === "active" ? "adminBadgeActive" : ""}`}>{detail.user.status}</span></dd></div>
            <div><dt>Platform role</dt><dd>{detail.user.platformRole ?? "None"}</dd></div>
            <div><dt>Created</dt><dd>{timestamp(detail.user.createdAt)}</dd></div>
            <div><dt>Confirmed</dt><dd>{timestamp(detail.user.confirmedAt)}</dd></div>
            <div><dt>Last sign-in</dt><dd>{timestamp(detail.user.lastSignInAt)}</dd></div>
            <div><dt>Workspace count</dt><dd>{detail.user.workspaceCount}</dd></div>
          </dl>
        </section>

        <aside className="adminPanel adminDangerPanel">
          <h2>Account controls</h2>
          <p>Every mutation re-checks platform authority server-side and writes a platform audit event. Destructive actions remain deliberately separated from account evidence.</p>
          <UserAdminControls
            userId={detail.user.id}
            email={detail.user.email}
            status={detail.user.status}
            platformRole={detail.user.platformRole}
            isCurrentUser={context.user.id === detail.user.id}
          />
        </aside>
      </div>

      <section className="adminSection">
        <h2>Workspace memberships</h2>
        <div className="adminTableWrap adminDesktopTable">
          <table className="adminTable">
            <thead><tr><th>Workspace</th><th>Role</th><th>Joined</th><th>ID</th></tr></thead>
            <tbody>
              {detail.workspaces.map((workspace) => (
                <tr key={workspace.id}>
                  <td><strong>{workspace.name}</strong><br /><span className="adminMuted">{workspace.slug}</span></td>
                  <td>{workspace.role}</td>
                  <td>{timestamp(workspace.joinedAt)}</td>
                  <td className="adminCode">{workspace.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {detail.workspaces.length === 0 ? <div className="adminEmpty">This user has no workspace memberships.</div> : null}
        </div>

        <div className="adminMobileCards" aria-label="Workspace memberships">
          {detail.workspaces.map((workspace) => (
            <article className="adminMobileCard" key={workspace.id}>
              <div className="adminMobileCardHeader">
                <div>
                  <span className="adminMobileCardEyebrow">Workspace membership</span>
                  <h2>{workspace.name}</h2>
                  <p>{workspace.slug}</p>
                </div>
                <span className="adminBadge adminBadgeActive">{workspace.role}</span>
              </div>
              <div className="adminMobileCardGrid">
                <div className="adminMobileDatum"><span>Joined</span><strong>{timestamp(workspace.joinedAt)}</strong></div>
                <div className="adminMobileDatum"><span>Workspace ID</span><strong className="adminCode">{workspace.id}</strong></div>
              </div>
            </article>
          ))}
          {detail.workspaces.length === 0 ? <div className="adminEmpty adminMobileCard">This user has no workspace memberships.</div> : null}
        </div>
      </section>
    </>
  );
}
