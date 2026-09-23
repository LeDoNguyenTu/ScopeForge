import Link from "next/link";
import { redirect } from "next/navigation";
import MfaChallengeForm from "@/components/auth/MfaChallengeForm";
import { readAssuranceState } from "@/lib/auth/assurance";
import { safeAuthReturnPath } from "@/lib/auth/return-path";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeAuthReturnPath((await searchParams).next);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/sign-in?next=${encodeURIComponent(next)}`);

  const assurance = await readAssuranceState(supabase.auth);
  if (assurance.currentLevel === "aal2") redirect(next);
  if (assurance.verifiedTotp.length === 0) redirect("/dashboard/settings/security?required=mfa");

  return (
    <main className="authPage">
      <section className="authCard" aria-labelledby="mfa-title">
        <Link className="authBrand" href="/"><span className="authIcon" aria-hidden="true">S</span>ScopeForge</Link>
        <div className="authHeading">
          <p className="eyebrow">Two-step verification</p>
          <h1 id="mfa-title">Verify it’s you</h1>
          <p>Enter the current code from your authenticator app to continue.</p>
        </div>
        <MfaChallengeForm factors={assurance.verifiedTotp} next={next} />
      </section>
    </main>
  );
}
