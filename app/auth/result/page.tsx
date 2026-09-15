import type { Metadata } from "next";
import type { AuthResultStatus } from "@/components/auth/AuthStatusCard";
import AuthResultClient from "@/components/auth/AuthResultClient";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Email confirmation", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function AuthResultPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: requested } = await searchParams;
  let status: AuthResultStatus = requested === "expired" || requested === "error" ? requested : "invalid";
  if (requested === "success") {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user?.email_confirmed_at) status = "success";
    } catch {
      status = "error";
    }
  }
  return <main className="authPage"><AuthResultClient status={status} /></main>;
}
