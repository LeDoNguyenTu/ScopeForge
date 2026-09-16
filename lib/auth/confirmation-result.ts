import { NextResponse } from "next/server";

export function confirmationFailure(error: unknown): "expired" | "invalid" | "error" {
  if (error && typeof error === "object") {
    if ("code" in error && error.code === "otp_expired") return "expired";
    if ("status" in error && typeof error.status === "number" && error.status >= 500) return "error";
  }
  return "invalid";
}

export function confirmationRedirect(origin: string, path: string) {
  const response = NextResponse.redirect(new URL(path, origin));
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
