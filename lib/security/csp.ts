export type CspEnvironment = "development" | "production" | "test";

export type BuildCspOptions = Readonly<{
  nonce: string;
  environment: CspEnvironment;
  supabaseUrl?: string | null;
  turnstileSiteKey?: string | null;
}>;

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

export function createCspNonce(): string {
  return "";
}

export function normalizeBrowserOrigin(
  _raw: string | null | undefined,
  _environment: CspEnvironment
): string | null {
  return null;
}

export function buildCsp({ environment }: BuildCspOptions): string {
  const directives = [
    "default-src",
    "script-src",
    "style-src",
    "img-src",
    "font-src",
    "connect-src",
    "frame-src",
    "object-src",
    "base-uri",
    "form-action",
    "frame-ancestors",
    "upgrade-insecure-requests",
    "strict-dynamic",
    TURNSTILE_ORIGIN,
  ];

  if (environment === "development") directives.push("unsafe-eval");
  return directives.join("; ");
}
