"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const signUp = mode === "sign-up";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      if (signUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: displayName.trim() || undefined } }
        });
        if (error) throw error;
        if (data.session) {
          window.location.assign("/dashboard");
          return;
        }
        setMessage("Account created. Check your email if confirmation is enabled.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign("/dashboard");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="authCard">
      <div className="authBrand"><span className="brandMark"><ShieldCheck size={18} /></span><span>ScopeForge</span></div>
      <div className="authHeading">
        <span className="authIcon"><LockKeyhole size={18} /></span>
        <h1>{signUp ? "Create your workspace" : "Welcome back"}</h1>
        <p>{signUp ? "Start with an isolated workspace for your authorized security assessments." : "Sign in to continue to your security workspace."}</p>
      </div>
      <form onSubmit={submit} className="authForm">
        {signUp && <label>Display name<input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Brian" maxLength={80} /></label>}
        <label>Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <label>Password<input required type="password" autoComplete={signUp ? "new-password" : "current-password"} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
        <button className="primaryButton authSubmit" disabled={busy} type="submit">{busy ? "Working..." : signUp ? "Create account" : "Sign in"}<ArrowRight size={16} /></button>
      </form>
      {message && <div className="authMessage" role="status">{message}</div>}
      <p className="authSwitch">{signUp ? "Already have an account?" : "New to ScopeForge?"} <Link href={signUp ? "/auth/sign-in" : "/auth/sign-up"}>{signUp ? "Sign in" : "Create account"}</Link></p>
      <p className="authFoot">Bot protection with Cloudflare Turnstile will be enabled before public trial access.</p>
    </div>
  );
}
