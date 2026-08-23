import { isIP } from "node:net";
import { isBlockedNetworkAddress } from "./network-boundary";
import type { AssetKind, NormalizedAssetTarget } from "./types";

const PRIVATE_OR_LOCAL = "Private or local targets are not supported in hosted ScopeForge verification.";

export function isBlockedAddress(hostname: string): boolean {
  const value = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    value === "localhost" ||
    value.endsWith(".localhost") ||
    value.endsWith(".local") ||
    value.endsWith(".internal")
  ) return true;

  return isIP(value) !== 0 && isBlockedNetworkAddress(value);
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
    if (url.port && url.port !== "443") throw new Error("Hosted ScopeForge verification supports HTTPS port 443 only in Phase 2.");
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length !== 2) throw new Error("Use a GitHub repository URL in the form https://github.com/owner/repository.");
    const [owner, rawRepo] = segments;
    const repo = rawRepo.replace(/\.git$/i, "");
    if (!owner || !repo) throw new Error("Use a valid public GitHub repository URL.");
    return { canonicalTarget: `https://github.com/${owner}/${repo}`, hostname, kind };
  }

  if (url.port && url.port !== "443") {
    throw new Error("Hosted ScopeForge verification supports HTTPS port 443 only in Phase 2.");
  }

  const pathname = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
  return {
    canonicalTarget: `https://${hostname}${pathname}`,
    hostname,
    kind
  };
}
