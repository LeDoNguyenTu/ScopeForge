import type { Metadata } from "next";
import { redirect } from "next/navigation";
import UpdatePasswordForm from "@/components/auth/UpdatePasswordForm";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Update password" };

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/forgot-password");
  return <main className="authPage"><UpdatePasswordForm /></main>;
}
