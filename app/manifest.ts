import type { MetadataRoute } from "next";
import { scopeForgeManifestIcons } from "@/lib/brand/browser-icons";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ScopeForge",
    short_name: "ScopeForge",
    description: "Open-source application security for discovering vulnerabilities, understanding what they could lead to, and preparing before they become incidents.",
    start_url: "/",
    display: "standalone",
    background_color: "#070a0d",
    theme_color: "#070a0d",
    icons: scopeForgeManifestIcons
  };
}
