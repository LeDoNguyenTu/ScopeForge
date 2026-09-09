"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Boxes, Bug, Gauge } from "lucide-react";

const items = [
  { href: "/dashboard", label: "Overview", Icon: Gauge, match: "exact" as const },
  { href: "/dashboard/assets", label: "Assets", Icon: Boxes, match: "prefix" as const },
  { href: "/dashboard/findings", label: "Findings", Icon: Bug, match: "prefix" as const },
  { href: "/dashboard/resources", label: "Resources", Icon: BookOpen, match: "prefix" as const },
];

export default function SideNav() {
  const pathname = usePathname();

  return (
    <nav className="sideNav" aria-label="Workspace navigation">
      {items.map(({ href, label, Icon, match }) => {
        const active = match === "exact" ? pathname === href || pathname === "/preview/dashboard" : pathname.startsWith(href);
        return (
          <Link
            className={`sideLink ${active ? "active" : ""}`}
            href={href}
            key={label}
            aria-current={active ? "page" : undefined}
            title={label}
          >
            <Icon size={17} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
