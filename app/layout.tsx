import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "ScopeForge - Application Security Platform",
    template: "%s | ScopeForge"
  },
  description: "A developer-first application security platform for authorized testing from code to runtime.",
  applicationName: "ScopeForge"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
