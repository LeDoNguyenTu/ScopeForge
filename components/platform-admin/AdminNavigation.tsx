"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  FlaskConical,
  LayoutDashboard,
  ScrollText,
  ServerCog,
  Settings,
  Users,
} from "lucide-react";
import ScopeForgeWordmark from "@/components/brand/ScopeForgeWordmark";

const navigation = [
  ["/admin", "Overview", LayoutDashboard],
  ["/admin/users", "Users", Users],
  ["/admin/workspaces", "Workspaces", Activity],
  ["/admin/phase11", "Phase 11", FlaskConical],
  ["/admin/providers", "Providers", ServerCog],
  ["/admin/audit", "Audit", ScrollText],
  ["/admin/settings", "Settings", Settings],
] as const;

function isActivePath(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function AdminNavLinks({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement | null>(null);
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);

  useLayoutEffect(() => {
    if (!mobile) return;
    const nav = navRef.current;
    const link = activeLinkRef.current;
    if (!nav || !link) return;
    const targetLeft = Math.max(0, link.offsetLeft - Math.max(0, (nav.clientWidth - link.offsetWidth) / 2));
    if (typeof nav.scrollTo === "function") nav.scrollTo({ left: targetLeft, behavior: "auto" });
    else nav.scrollLeft = targetLeft;
  }, [mobile, pathname]);

  return (
    <nav
      ref={navRef}
      className={mobile ? "platformAdminMobileNav" : "platformAdminNav"}
      aria-label={mobile ? "Platform administration mobile" : "Platform administration"}
    >
      {navigation.map(([href, label, Icon]) => {
        const active = isActivePath(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={active ? "isActive" : undefined}
            aria-current={active ? "page" : undefined}
            ref={active ? activeLinkRef : undefined}
          >
            <Icon size={mobile ? 18 : 17} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminNavigation({
  email,
  role,
}: {
  email: string;
  role: "owner" | "admin";
}) {
  const roleLabel = role === "owner" ? "Platform owner" : "Platform admin";

  return (
    <>
      <aside className="platformAdminSidebar">
        <Link className="platformAdminBrand" href="/admin" aria-label="ScopeForge platform administration">
          <ScopeForgeWordmark compact />
          <span className="platformAdminBrandContext">Control plane</span>
        </Link>

        <AdminNavLinks />

        <div className="platformAdminIdentity">
          <span title={email}>{email}</span>
          <strong>{roleLabel}</strong>
        </div>

        <Link className="platformAdminBack" href="/dashboard">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to workspace
        </Link>
      </aside>

      <header className="platformAdminMobileHeader">
        <Link className="platformAdminMobileBrand" href="/admin" aria-label="ScopeForge platform administration">
          <ScopeForgeWordmark compact />
          <span>{roleLabel}</span>
        </Link>
        <Link className="platformAdminMobileBack" href="/dashboard" aria-label="Back to workspace">
          <ArrowLeft size={17} aria-hidden="true" />
        </Link>
      </header>

      <AdminNavLinks mobile />
    </>
  );
}
