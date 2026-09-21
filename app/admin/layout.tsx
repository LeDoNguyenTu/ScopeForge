import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import AdminNavigation from "@/components/platform-admin/AdminNavigation";
import { getPlatformAdminAccessState } from "@/lib/platform-admin/authorization";
import "./admin.css";
import "./admin-responsive.css";
import "./admin-settings.css";

export const metadata: Metadata = {
  title: {
    default: "Platform admin",
    template: "%s | ScopeForge Admin",
  },
};
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await getPlatformAdminAccessState();
  if (access.status === "unauthenticated") redirect("/auth/sign-in");
  if (access.status === "denied") notFound();

  const context = access.context;
  return (
    <div className="platformAdminShell">
      <a className="skipLink" href="#platform-admin-content">Skip to admin content</a>
      <AdminNavigation
        email={context.user.email ?? "Platform administrator"}
        role={context.role}
      />
      <main className="platformAdminMain" id="platform-admin-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
