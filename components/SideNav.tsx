"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
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

  useLayoutEffect(() => {
    const link = activeLinkRef.current;
    const rail = link?.closest(".immersiveDashboardLinks");
    if (!link || !(rail instanceof HTMLElement)) return;

    const centerActiveLink = () => {
      const railRect = rail.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
      const targetLeft = rail.scrollLeft
        + (linkRect.left - railRect.left)
        - Math.max(0, (rail.clientWidth - linkRect.width) / 2);
      const nextLeft = Math.min(maxScrollLeft, Math.max(0, targetLeft));

      if (Math.abs(rail.scrollLeft - nextLeft) < 1) return;
      if (typeof rail.scrollTo === "function") rail.scrollTo({ left: nextLeft, behavior: "auto" });
      else rail.scrollLeft = nextLeft;
    };

    centerActiveLink();

    const frame = typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame(centerActiveLink)
      : null;
    const observer = typeof ResizeObserver === "function"
      ? new ResizeObserver(centerActiveLink)
      : null;

    observer?.observe(rail);
    observer?.observe(link);
    window.addEventListener("resize", centerActiveLink);

    return () => {
      if (frame !== null && typeof window.cancelAnimationFrame === "function") window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", centerActiveLink);
    };
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
