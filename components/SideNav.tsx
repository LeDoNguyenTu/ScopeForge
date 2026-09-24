"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { BookOpen, Boxes, Bug, Gauge, Radar, Settings, Users } from "lucide-react";

const items = [
  { href: "/dashboard", label: "Overview", Icon: Gauge, match: "exact" as const },
  { href: "/dashboard/assets", label: "Assets", Icon: Boxes, match: "prefix" as const },
  { href: "/dashboard/findings", label: "Findings", Icon: Bug, match: "prefix" as const },
  { href: "/dashboard/security-runs", label: "Security runs", Icon: Radar, match: "prefix" as const },
  { href: "/dashboard/resources", label: "Resources", Icon: BookOpen, match: "prefix" as const },
  { href: "/dashboard/workspace", label: "Workspace", Icon: Users, match: "prefix" as const },
  { href: "/dashboard/settings/security", label: "Account & security", Icon: Settings, match: "prefix" as const },
];

function isActivePath(pathname: string, href: string, match: "exact" | "prefix"): boolean {
  if (pathname === "/preview/security-runs") return href === "/dashboard/security-runs";
  if (match === "exact") return pathname === href || pathname === "/preview/dashboard";
  return pathname.startsWith(href);
}

export default function SideNav() {
  const pathname = usePathname();
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const link = activeLinkRef.current;
    const rail = link?.closest(".immersiveDashboardLinks");
    if (!link || !(rail instanceof HTMLElement)) return;

    const targetLeft = Math.max(0, link.offsetLeft - Math.max(0, (rail.clientWidth - link.offsetWidth) / 2));
    if (typeof rail.scrollTo === "function") rail.scrollTo({ left: targetLeft, behavior: "auto" });
    else rail.scrollLeft = targetLeft;
  }, [pathname]);

  return (
    <nav className="sideNav" aria-label="Workspace navigation">
      {items.map(({ href, label, Icon, match }) => {
        const active = isActivePath(pathname, href, match);
        return (
          <Link
            className={`sideLink ${active ? "active" : ""}`}
            href={href}
            key={label}
            aria-current={active ? "page" : undefined}
            ref={active ? activeLinkRef : undefined}
            title={label}
          >
            <Icon size={17} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
