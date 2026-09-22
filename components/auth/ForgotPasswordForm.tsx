"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Mail, ShieldCheck } from "lucide-react";
import ScopeForgeWordmark from "@/components/brand/ScopeForgeWordmark";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordForm() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setUnavailable(false);
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: new URL("/auth/callback?next=/auth/update-password", window.location.origin).toString(),
      });
      setSent(true);
      setEmail("");
    } catch {
      setUnavailable(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="authCard" aria-labelledby="forgot-password-title">
      <Link className="authBrand" href="/" aria-label="ScopeForge home"><ScopeForgeWordmark /></Link>
      <div className="authHeading">
        <span className="authIcon"><Mail size={18} /></span>
        <h1 id="forgot-password-title">Recover your account</h1>
        <p>Enter your account email. We will send a time-limited recovery link if the account is eligible.</p>
      </div>
      {sent ? (
        <div className="authRecoveryResult" role="status">
          <ShieldCheck size={20} />
          <div><strong>Check your email</strong><p>If an account exists for that email, a recovery link is on its way.</p></div>
        </div>
      ) : (
        <form className="authForm" onSubmit={submit}>
          <label>Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          <button className="primaryButton authSubmit" disabled={busy} type="submit">{busy ? "Sending..." : "Send recovery email"}<ArrowRight size={16} /></button>
        </form>
      )}
      {unavailable ? <div className="authMessage authMessageError" role="alert">Recovery email is temporarily unavailable. Please try again later.</div> : null}
      <Link className="authBackLink" href="/auth/sign-in"><ArrowLeft size={14} /> Back to sign in</Link>
    </section>
  );
}
