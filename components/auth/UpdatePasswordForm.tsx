"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, KeyRound } from "lucide-react";
import ScopeForgeWordmark from "@/components/brand/ScopeForgeWordmark";
import { validateNewPassword } from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordForm() {
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateNewPassword(password, confirmation);
    if (validation) {
      setMessage(validation);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage("The password could not be updated. Request a new recovery link and try again.");
        return;
      }
      setPassword("");
      setConfirmation("");
      setComplete(true);
    } catch {
      setMessage("The password could not be updated. Request a new recovery link and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="authCard" aria-labelledby="update-password-title">
      <Link className="authBrand" href="/" aria-label="ScopeForge home"><ScopeForgeWordmark /></Link>
      <div className="authHeading">
        <span className="authIcon">{complete ? <CheckCircle2 size={18} /> : <KeyRound size={18} />}</span>
        <h1 id="update-password-title">{complete ? "Password updated" : "Choose a new password"}</h1>
        <p>{complete ? "Your password has been updated. You can continue securely." : "Use a unique password with at least 12 characters."}</p>
      </div>
      {complete ? (
        <div className="authRecoveryResult" role="status">Your password has been updated.</div>
      ) : (
        <form className="authForm" onSubmit={submit}>
          <label>New password<input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <label>Confirm new password<input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
          <button className="primaryButton authSubmit" disabled={busy} type="submit">{busy ? "Updating..." : "Update password"}</button>
        </form>
      )}
      {message ? <div className="authMessage authMessageError" role="alert">{message}</div> : null}
      <Link className="authBackLink" href={complete ? "/dashboard" : "/auth/forgot-password"}><ArrowLeft size={14} /> {complete ? "Continue to workspace" : "Request another link"}</Link>
    </section>
  );
}
