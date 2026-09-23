"use client";

import { useCallback, useEffect, useState } from "react";
import type { AssuranceState } from "@/lib/auth/assurance";
import { useToast } from "@/components/feedback/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import PasskeyManager from "@/components/auth/PasskeyManager";
import PasswordChangeForm from "@/components/auth/PasswordChangeForm";

type Enrollment = { id: string; qrCode: string; secret: string };
const EMPTY_STATE: AssuranceState = { currentLevel: null, nextLevel: null, verifiedTotp: [], unverifiedTotp: [] };

export default function AccountSecurityPanel({ email }: { email: string }) {
  const toast = useToast();
  const [state, setState] = useState(EMPTY_STATE);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [factors, levels] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (factors.error || levels.error || !factors.data || !levels.data) {
      setError("Account security details are temporarily unavailable.");
      return;
    }
    const totp = factors.data.totp ?? [];
    const unverifiedTotp = (factors.data.all ?? []).filter((factor) => (
      factor.factor_type === "totp" && factor.status === "unverified"
    ));
    const normalize = (factor: { id: string; friendly_name?: string | null }) => ({
      id: factor.id,
      friendlyName: factor.friendly_name?.trim() || "Authenticator app",
    });
    const normalizeLevel = (level: string | null): "aal1" | "aal2" | null => (
      level === "aal1" ? "aal1" : level === "aal2" ? "aal2" : null
    );
    const currentLevel = normalizeLevel(levels.data.currentLevel);
    const nextLevel = normalizeLevel(levels.data.nextLevel);
    setState({
      currentLevel,
      nextLevel,
      verifiedTotp: totp.filter((factor) => factor.status === "verified").map(normalize),
      unverifiedTotp: unverifiedTotp.map(normalize),
    });
    setError("");
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function beginEnrollment() {
    setPending(true);
    setError("");
    const supabase = createClient();
    for (const factor of state.unverifiedTotp) {
      const cleanup = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (cleanup.error) {
        setError("The unfinished authenticator setup could not be cleared. Please retry.");
        setPending(false);
        return;
      }
    }
    const result = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator" });
    if (result.error || !result.data?.totp?.qr_code || !result.data.totp.secret) {
      setError("Authenticator setup could not be started.");
    } else {
      setEnrollment({ id: result.data.id, qrCode: result.data.totp.qr_code, secret: result.data.totp.secret });
    }
    setPending(false);
  }

  async function copySetupKey() {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      toast.success("Setup key copied.");
    } catch {
      toast.error("Setup key could not be copied.");
    }
  }

  async function verifyEnrollment(event: React.FormEvent) {
    event.preventDefault();
    if (!enrollment) return;
    setPending(true);
    setError("");
    const result = await createClient().auth.mfa.challengeAndVerify({ factorId: enrollment.id, code });
    if (result.error) {
      setError("That code could not be verified. Check your authenticator and try again.");
      setPending(false);
      return;
    }
    setEnrollment(null);
    setCode("");
    await refresh();
    toast.success("Authenticator app enabled.");
    setPending(false);
  }

  async function removeFactor(factorId: string) {
    if (!window.confirm("Remove this authenticator from your account?")) return;
    setPending(true);
    const result = await createClient().auth.mfa.unenroll({ factorId });
    if (result.error) {
      toast.error("The authenticator could not be removed.");
    } else {
      await refresh();
      toast.success("Authenticator removed.");
    }
    setPending(false);
  }

  return (
    <div className="securitySettingsGrid">
      <section className="panel securitySettingsCard" aria-labelledby="account-security-heading">
        <p className="eyebrow">Account</p>
        <h1 id="account-security-heading">Account &amp; security</h1>
        <p className="muted">Manage how you sign in and protect privileged workspace actions.</p>
        <dl className="securityIdentity"><div><dt>Email</dt><dd>{email}</dd></div><div><dt>Session assurance</dt><dd>{state.currentLevel?.toUpperCase() ?? "Checking…"}</dd></div></dl>
      </section>

      <section className="panel securitySettingsCard" aria-labelledby="authenticator-heading">
        <p className="eyebrow">Two-step verification</p>
        <h2 id="authenticator-heading">Authenticator app</h2>
        <p className="muted">Use a six-digit code after your password. Owners and admins must keep a verified factor enrolled.</p>
        {state.verifiedTotp.length === 0 ? <p>No authenticator is enrolled yet.</p> : (
          <ul className="securityFactorList">{state.verifiedTotp.map((factor) => (
            <li key={factor.id}><span>{factor.friendlyName}</span><button className="secondaryButton" disabled={pending} onClick={() => void removeFactor(factor.id)} type="button">Remove</button></li>
          ))}</ul>
        )}
        {!enrollment ? <button className="primaryButton" disabled={pending} onClick={() => void beginEnrollment()} type="button">{state.unverifiedTotp.length > 0 ? "Restart authenticator setup" : "Set up authenticator"}</button> : (
          <form className="authForm securityEnrollment" onSubmit={verifyEnrollment}>
            <div className="securityEnrollmentSetup">
              <img alt="Authenticator QR code" className="securityQrCode" src={enrollment.qrCode} />
              <div className="securityManualKey">
                <label htmlFor="manual-setup-key">Manual setup key</label>
                <input autoComplete="off" id="manual-setup-key" readOnly spellCheck={false} value={enrollment.secret} />
                <button className="secondaryButton" onClick={() => void copySetupKey()} type="button">Copy setup key</button>
              </div>
            </div>
            <p className="muted">Scan this code with your authenticator app, then enter the generated code to finish.</p>
            <label htmlFor="enrollment-code">Verification code</label>
            <input id="enrollment-code" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
            <button className="primaryButton" disabled={pending || code.length !== 6} type="submit">Verify and enable</button>
          </form>
        )}
        {error ? <p className="authMessage" role="alert">{error}</p> : null}
      </section>
      <PasskeyManager />
      <PasswordChangeForm />
    </div>
  );
}
