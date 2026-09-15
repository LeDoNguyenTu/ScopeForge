import { confirmationFailure, confirmationRedirect } from "@/lib/auth/confirmation-result";
import { safeAuthReturnPath } from "@/lib/auth/return-path";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.has("next") ? safeAuthReturnPath(url.searchParams.get("next")) : "/auth/result?status=success";

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      return confirmationRedirect(url.origin, error ? `/auth/result?status=${confirmationFailure(error)}` : next);
    } catch {
      return confirmationRedirect(url.origin, "/auth/result?status=error");
    }
  }

  return confirmationRedirect(url.origin, "/auth/result?status=invalid");
}
