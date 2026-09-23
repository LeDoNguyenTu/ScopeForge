"use client";

import { useState } from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import { validateNewPassword } from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/client";

export default function PasswordChangeForm() {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const validation = validateNewPassword(password, confirmation);
    if (validation) {
      setError(validation);
      return;
    }
    setPending(true);
    setError("");
    try {
      const result = await createClient().auth.updateUser({ current_password: currentPassword, password });
      if (result.error) throw result.error;
      setCurrentPassword("");
      setPassword("");
      setConfirmation("");
      toast.success("Password changed.");
    } catch {
      setError("The password could not be changed. Check your current password and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel securitySettingsCard" aria-labelledby="password-heading">
      <p className="eyebrow">Credentials</p>
      <h2 id="password-heading">Change password</h2>
      <p className="muted">Use a unique password with at least 12 characters.</p>
      <form className="authForm securityPasswordForm" onSubmit={submit}>
        <label>Current password<input autoComplete="current-password" maxLength={128} required type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
        <label>New password<input autoComplete="new-password" maxLength={128} minLength={12} required type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <label>Confirm new password<input autoComplete="new-password" maxLength={128} minLength={12} required type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
        <button className="primaryButton" disabled={pending} type="submit">{pending ? "Changing password…" : "Change password"}</button>
      </form>
      {error ? <p className="authMessage authMessageError" role="alert">{error}</p> : null}
    </section>
  );
}
