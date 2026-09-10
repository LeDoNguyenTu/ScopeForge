import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import AuthForm from "@/components/AuthForm";
import { getPlatformSettings } from "@/lib/platform-settings/server";

export const metadata: Metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  const [nonce, settings] = await Promise.all([
    headers().then((value) => value.get("x-nonce")),
    getPlatformSettings(),
  ]);

  if (!settings.registrationEnabled) {
    return (
      <main className="authPage">
        <section className="authCard" aria-labelledby="registration-closed-title">
          <p className="eyebrow">Registration closed</p>
          <h1 id="registration-closed-title">New ScopeForge accounts are temporarily disabled.</h1>
          <p>Existing users can still sign in. Platform administrators can reopen registration from the admin console.</p>
          <Link className="button primaryButton" href="/auth/sign-in">Sign in</Link>
        </section>
      </main>
    );
  }

  return <main className="authPage"><AuthForm mode="sign-up" nonce={nonce} /></main>;
}
