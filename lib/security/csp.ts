export type CspEnvironment = "development" | "production" | "test";

export type BuildCspOptions = Readonly<{
  nonce: string;
  environment: CspEnvironment;
  supabaseUrl?: string | null;
  turnstileSiteKey?: string | null;
}>;

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function createCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function normalizeBrowserOrigin(
  raw: string | null | undefined,
  environment: CspEnvironment
): string | null {
  const candidate = raw?.trim();
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.pathname !== "/" && url.pathname !== "") return null;

    if (url.protocol === "https:") return url.origin;

    const localHttpAllowed = environment !== "production"
      && url.protocol === "http:"
      && LOOPBACK_HOSTS.has(url.hostname);

    return localHttpAllowed ? url.origin : null;
  } catch {
    return null;
  }
}

export function buildCsp({
  nonce,
  environment,
  supabaseUrl,
  turnstileSiteKey,
}: BuildCspOptions): string {
  const supabaseOrigin = normalizeBrowserOrigin(supabaseUrl, environment);
  const turnstileEnabled = Boolean(turnstileSiteKey?.trim());
  const nonceSource = `'nonce-${nonce}'`;

  const scriptSources = ["'self'", nonceSource, "'strict-dynamic'"];
  if (environment === "development") scriptSources.push("'unsafe-eval'");
  if (turnstileEnabled) scriptSources.push(TURNSTILE_ORIGIN);

  const connectSources = ["'self'"];
  if (supabaseOrigin) connectSources.push(supabaseOrigin);

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    `style-src 'self' ${nonceSource}`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connectSources.join(" ")}`,
    turnstileEnabled ? `frame-src ${TURNSTILE_ORIGIN}` : "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  if (environment === "production") directives.push("upgrade-insecure-requests");

  return directives.join("; ");
}
