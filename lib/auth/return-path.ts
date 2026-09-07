const FALLBACK_AUTH_RETURN_PATH = "/dashboard";
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

export function safeAuthReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) return FALLBACK_AUTH_RETURN_PATH;
  if (value.startsWith("//") || value.includes("\\")) return FALLBACK_AUTH_RETURN_PATH;
  if (CONTROL_CHARACTER.test(value)) return FALLBACK_AUTH_RETURN_PATH;

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return FALLBACK_AUTH_RETURN_PATH;
  }

  if (CONTROL_CHARACTER.test(decoded) || decoded.includes("\\") || decoded.startsWith("//")) {
    return FALLBACK_AUTH_RETURN_PATH;
  }

  try {
    const origin = "https://scopeforge.invalid";
    const parsed = new URL(value, origin);
    if (parsed.origin !== origin) return FALLBACK_AUTH_RETURN_PATH;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return FALLBACK_AUTH_RETURN_PATH;
  }
}
