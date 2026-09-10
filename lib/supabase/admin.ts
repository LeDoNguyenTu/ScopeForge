import { disableDemoBackend } from "@/lib/demo/disable-backend";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export function createAdminClient<TDatabase = Database>() {
  disableDemoBackend();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error("Trusted Supabase verification credentials are not configured.");
  }

  return createClient<TDatabase>(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}
