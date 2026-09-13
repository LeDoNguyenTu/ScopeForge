import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import AdminNavigation from "@/components/platform-admin/AdminNavigation";
import {
  PlatformAdminAuthorizationError,
  requirePlatformAdmin,
} from "@/lib/platform-admin/authorization";
import "./admin.css";
import "./admin-responsive.css";

export const metadata: Metadata = {
  title: {
    default: "Platform admin",
    template: "%s | ScopeForge Admin",
  },
};
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let context;
  try {
    context = await requirePlatformAdmin();
  } catch (error) {
    if (
      error instanceof PlatformAdminAuthorizationError
      && error.code === "PLATFORM_ADMIN_UNAUTHENTICATED"
    ) {
      redirect("/auth/sign-in");
    }
    notFound();
  }

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
