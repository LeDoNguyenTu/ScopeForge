"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import TurnstileChallenge from "@/components/auth/TurnstileChallenge";
import ScopeForgeWordmark from "@/components/brand/ScopeForgeWordmark";
import { authErrorMessage } from "@/lib/auth/error-message";
import { createClient } from "@/lib/supabase/client";

export default function AuthForm({
  mode,
  captchaSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null,
  nonce = null
}: {
  mode: "sign-in" | "sign-up";
  captchaSiteKey?: string | null;
  nonce?: string | null;
}) {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaEpoch, setCaptchaEpoch] = useState(0);
  const signUp = mode === "sign-up";
  const normalizedCaptchaSiteKey = captchaSiteKey?.trim() || null;
  const captchaRequired = Boolean(normalizedCaptchaSiteKey);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    if (captchaRequired && !captchaToken) {
      setMessage("Complete the security check to continue.");
      setBusy(false);
      return;
    }

    try {
      if (signUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: displayName.trim() || undefined },
            ...(captchaToken ? { captchaToken } : {})
          }
        });
        if (error) throw error;
        if (data.session) {
          window.location.assign("/dashboard");
          return;
        }
        setMessage("Account created. Check your email if confirmation is enabled.");
      } else {
        const { error } = await supabase.auth.signInWithPassword(
          captchaToken
            ? { email, password, options: { captchaToken } }
            : { email, password }
        );
        if (error) throw error;
        window.location.assign("/dashboard");
      }
    } catch (error) {
      setMessage(authErrorMessage(error, mode));
    } finally {
      if (captchaRequired) {
        setCaptchaToken(null);
        setCaptchaEpoch((value) => value + 1);
      }
      setBusy(false);
    }
  }

  return (
    <div className="authCard">
      <Link className="authBrand" href="/" aria-label="ScopeForge home"><ScopeForgeWordmark /></Link>
      <div className="authHeading">
        <span className="authIcon"><LockKeyhole size={18} /></span>
        <h1>{signUp ? "Create your workspace" : "Welcome back"}</h1>
        <p>{signUp ? "Start with an isolated workspace for your authorized security assessments." : "Sign in to continue to your security workspace."}</p>
      </div>
      <form onSubmit={submit} className="authForm">
        {signUp && <label>Display name<input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Brian" maxLength={80} /></label>}
        <label>Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <label>Password<input required type="password" autoComplete={signUp ? "new-password" : "current-password"} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
        {normalizedCaptchaSiteKey && (
          <div className="authCaptcha">
            <TurnstileChallenge
              key={captchaEpoch}
              siteKey={normalizedCaptchaSiteKey}
              nonce={nonce}
              onToken={setCaptchaToken}
            />
          </div>
        )}
        <button className="primaryButton authSubmit" disabled={busy || (captchaRequired && !captchaToken)} type="submit">{busy ? "Working..." : signUp ? "Create account" : "Sign in"}<ArrowRight size={16} /></button>
      </form>
      {message && <div className="authMessage" role="status">{message}</div>}
      <p className="authSwitch">{signUp ? "Already have an account?" : "New to ScopeForge?"} <Link href={signUp ? "/auth/sign-in" : "/auth/sign-up"}>{signUp ? "Sign in" : "Create account"}</Link></p>
      <p className="authFoot"><ShieldCheck size={16} /> A dedicated workspace for the assets you control.</p>
      <Link className="authBackLink" href="/"><ArrowLeft size={14} /> Back to ScopeForge</Link>
    </div>
  );
}
