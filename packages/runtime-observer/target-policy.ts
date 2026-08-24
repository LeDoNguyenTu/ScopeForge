import type { AuthorizedRuntimeTarget, RedirectDecision } from "./contracts";

function parseAbsoluteUrl(value: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error("Runtime target must be a valid absolute URL.");
  }
}

function hasNonStandardHttpsPort(url: URL): boolean {
  return url.port !== "" && url.port !== "443";
}

function hasCredentials(url: URL): boolean {
  return url.username.length > 0 || url.password.length > 0;
}

export function validateInitialRuntimeUrl(target: AuthorizedRuntimeTarget): URL {
  const url = parseAbsoluteUrl(target.canonicalUrl);

  if (url.protocol !== "https:") {
    throw new Error("Runtime observation requires HTTPS.");
  }
  if (hasNonStandardHttpsPort(url)) {
    throw new Error("Runtime observation allows port 443 only.");
  }
  if (hasCredentials(url)) {
    throw new Error("Runtime observation targets cannot contain credentials.");
  }
  if (url.hostname.toLowerCase() !== target.hostname.toLowerCase()) {
    throw new Error("Runtime target must remain on the verified hostname.");
  }

  url.hash = "";
  return url;
}

export function validateRedirectTarget(
  current: URL,
  location: string,
  authorized: AuthorizedRuntimeTarget,
): RedirectDecision {
  let next: URL;
  try {
    next = new URL(location, current);
  } catch {
    return { allowed: false, reason: "SCHEME" };
  }

  if (next.protocol !== "https:") {
    return { allowed: false, reason: "SCHEME" };
  }
  if (hasNonStandardHttpsPort(next)) {
    return { allowed: false, reason: "PORT" };
  }
  if (hasCredentials(next)) {
    return { allowed: false, reason: "CREDENTIALS" };
  }
  if (next.hostname.toLowerCase() !== authorized.hostname.toLowerCase()) {
    return { allowed: false, reason: "CROSS_HOST" };
  }

  next.hash = "";
  return { allowed: true, url: next };
}
