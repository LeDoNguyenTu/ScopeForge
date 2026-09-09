import type { Metadata } from "next";
import { connection } from "next/server";
import { scopeForgeIconMetadata } from "@/lib/brand/browser-icons";
import "./globals.css";
import "./forge.css";
import "./forge-landing.css";
import "./forge-shell.css";
import "./forge-immersive.css";
import "./forge-dashboard.css";
import "./forge-dashboard-v2.css";
import "./exact-command-center.css";
import "./command-center-boot.css";
import "./command-center-v5.css";
import "./assets.css";
import "./community.css";
import "./ui-refinement.css";
import "./saas-dashboard.css";
import "./csp-compatibility.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "ScopeForge - Understand Security Risk Before It Becomes an Incident",
    template: "%s | ScopeForge"
  },
  description: "Open-source application security for discovering vulnerabilities, understanding what they could lead to, and preparing before they become incidents.",
  applicationName: "ScopeForge",
  icons: scopeForgeIconMetadata
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
