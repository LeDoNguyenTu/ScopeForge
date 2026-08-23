import { isIP } from "node:net";
import type { AssetKind, NormalizedAssetTarget } from "./types";

const PRIVATE_OR_LOCAL = "Private or local targets are not supported in hosted ScopeForge verification.";

function isBlockedIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function isBlockedIpv6(hostname: string): boolean {
  const value = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("ff") || /^fe[89ab]/.test(value);
}

export function isBlockedAddress(hostname: string): boolean {
  const value = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (value === "localhost" || value.endsWith(".localhost") || value.endsWith(".local")) return true;
  const version = isIP(value);
  if (version === 4) return isBlockedIpv4(value);
  if (version === 6) return isBlockedIpv6(value);
  return false;
}

export function normalizeAssetTarget(input: string, kind: AssetKind): NormalizedAssetTarget {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("A target is required.");

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Enter a valid absolute URL.");
  }

  if (url.protocol !== "https:") throw new Error("Hosted ScopeForge verification requires HTTPS targets.");
  if (url.username || url.password) throw new Error("Embedded credentials are not allowed in asset targets.");
  if (url.hash) throw new Error("URL fragments are not allowed in asset targets.");
  if (url.search) throw new Error("Query strings are not allowed in asset targets.");

  const hostname = url.hostname.toLowerCase();
  if (isBlockedAddress(hostname)) throw new Error(PRIVATE_OR_LOCAL);

  if (kind === "repository") {
    if (hostname !== "github.com") throw new Error("Phase 2 repository assets support public GitHub URLs only.");
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length !== 2) throw new Error("Use a GitHub repository URL in the form https://github.com/owner/repository.");
    const [owner, rawRepo] = segments;
    const repo = rawRepo.replace(/\.git$/i, "");
    if (!owner || !repo) throw new Error("Use a valid public GitHub repository URL.");
    return { canonicalTarget: `https://github.com/${owner}/${repo}`, hostname, kind };
  }

  const pathname = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
  const port = url.port ? `:${url.port}` : "";
  return {
    canonicalTarget: `https://${hostname}${port}${pathname}`,
    hostname,
    kind
  };
}
