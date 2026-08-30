import type { Metadata } from "next";
import "./globals.css";
import "./forge.css";
import "./forge-landing.css";
import "./forge-shell.css";
import "./forge-dashboard.css";
import "./assets.css";
import "./community.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "ScopeForge - Understand Security Risk Before It Becomes an Incident",
    template: "%s | ScopeForge"
  },
  description: "Open-source application security for discovering vulnerabilities, understanding what they could lead to, and preparing before they become incidents.",
  applicationName: "ScopeForge",
  icons: {
    icon: [
      {
        url: "/scopeforge-mark-v2.svg",
        type: "image/svg+xml",
        sizes: "any"
      }
    ],
    shortcut: [
      {
        url: "/scopeforge-mark-v2.svg",
        type: "image/svg+xml"
      }
    ],
    apple: [
      {
        url: "/scopeforge-mark-v2.svg",
        type: "image/svg+xml",
        sizes: "180x180"
      }
    ]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
