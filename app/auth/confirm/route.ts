import { confirmationFailure, confirmationRedirect } from "@/lib/auth/confirmation-result";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeAuthReturnPath } from "@/lib/auth/return-path";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const allowedTypes: readonly string[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"] satisfies EmailOtpType[];
  const next = url.searchParams.has("next")
    ? safeAuthReturnPath(url.searchParams.get("next"))
    : type === "recovery" ? "/auth/update-password" : "/auth/result?status=success";

  if (tokenHash && type && allowedTypes.includes(type)) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
      return confirmationRedirect(url.origin, error ? `/auth/result?status=${confirmationFailure(error)}` : next);
    } catch {
      return confirmationRedirect(url.origin, "/auth/result?status=error");
    }
  }

  return confirmationRedirect(url.origin, "/auth/result?status=invalid");
}
