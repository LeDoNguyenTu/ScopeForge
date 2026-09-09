export type AuthFormMode = "sign-in" | "sign-up";

const RATE_LIMIT_MARKERS = ["rate limit", "too many requests", "over_request_rate_limit"];

export function authErrorMessage(error: unknown, mode: AuthFormMode): string {
  const raw = error instanceof Error ? error.message.toLowerCase() : "";

  if (RATE_LIMIT_MARKERS.some((marker) => raw.includes(marker))) {
    return "Too many authentication attempts. Try again later.";
  }

  return mode === "sign-up"
    ? "Unable to create the account. Review your details and try again."
    : "Unable to sign in. Check your credentials and try again.";
}
