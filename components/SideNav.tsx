"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Bug, FileText, Gauge, ScanSearch } from "lucide-react";

const items = [
  { href: "/dashboard", label: "Overview", Icon: Gauge, match: "exact" as const },
  { href: "/dashboard/assets", label: "Assets", Icon: Boxes, match: "prefix" as const },
  { href: "/dashboard#phase-roadmap", label: "Scans", Icon: ScanSearch, match: "none" as const },
  { href: "/dashboard#phase-roadmap", label: "Findings", Icon: Bug, match: "none" as const },
  { href: "/dashboard#phase-roadmap", label: "Reports", Icon: FileText, match: "none" as const }
];

export default function SideNav() {
  const pathname = usePathname();

  return (
    <nav className="sideNav" aria-label="Workspace navigation">
      {items.map(({ href, label, Icon, match }) => {
        const active = match === "exact" ? pathname === href : match === "prefix" ? pathname.startsWith(href) : false;
        return (
          <Link
            className={`sideLink ${active ? "active" : ""}`}
            href={href}
            key={label}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={17} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
