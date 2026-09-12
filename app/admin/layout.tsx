import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  LayoutDashboard,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  PlatformAdminAuthorizationError,
  requirePlatformAdmin,
} from "@/lib/platform-admin/authorization";
import "./admin.css";

export const metadata: Metadata = {
  title: {
    default: "Platform admin",
    template: "%s | ScopeForge Admin",
  },
};
export const dynamic = "force-dynamic";

const navigation = [
  ["/admin", "Overview", LayoutDashboard],
  ["/admin/users", "Users", Users],
  ["/admin/workspaces", "Workspaces", Activity],
  ["/admin/audit", "Audit", ScrollText],
  ["/admin/settings", "Settings", Settings],
] as const;

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
      <aside className="platformAdminSidebar">
        <div className="platformAdminBrand">
          <span className="platformAdminBrandMark"><ShieldCheck size={20} /></span>
          <div>
            <strong>ScopeForge</strong>
            <span>Platform administration</span>
          </div>
        </div>

        <nav className="platformAdminNav" aria-label="Platform administration">
          {navigation.map(([href, label, Icon]) => (
            <Link key={href} href={href}><Icon size={17} /> {label}</Link>
          ))}
        </nav>

        <div className="platformAdminIdentity">
          <span>{context.user.email ?? "Platform administrator"}</span>
          <strong>{context.role === "owner" ? "Platform owner" : "Platform admin"}</strong>
        </div>

        <Link className="platformAdminBack" href="/dashboard"><ArrowLeft size={16} /> Back to workspace</Link>
      </aside>

      <main className="platformAdminMain" id="platform-admin-content">
        {children}
      </main>
    </div>
  );
}
