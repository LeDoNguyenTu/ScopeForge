"use client";

import { useCallback, useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import { useToast } from "@/components/feedback/ToastProvider";
import { createClient } from "@/lib/supabase/client";

type Passkey = { id: string; friendly_name?: string; created_at: string; last_used_at?: string };

export default function PasskeyManager() {
  const toast = useToast();
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const result = await createClient().auth.passkey.list();
      if (result.error) throw result.error;
      setPasskeys(result.data ?? []);
      setError("");
    } catch {
      setError("Passkey management is not available for this deployment.");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function register() {
    setPending(true);
    setError("");
    try {
      const result = await createClient().auth.registerPasskey();
      if (result.error) throw result.error;
      await refresh();
      toast.success("Passkey created.");
    } catch {
      setError("Passkey setup is unavailable or was cancelled.");
    } finally {
      setPending(false);
    }
  }

  async function remove(passkeyId: string) {
    if (!window.confirm("Remove this passkey from your account?")) return;
    setPending(true);
    try {
      const result = await createClient().auth.passkey.delete({ passkeyId });
      if (result.error) throw result.error;
      await refresh();
      toast.success("Passkey removed.");
    } catch {
      toast.error("The passkey could not be removed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel securitySettingsCard" aria-labelledby="passkeys-heading">
      <p className="eyebrow">Passwordless sign-in</p>
      <h2 id="passkeys-heading">Passkeys</h2>
      <p className="muted">Use your device biometrics or security key for phishing-resistant sign-in. Passkeys are a primary sign-in method; privileged sessions still require the authenticator step above.</p>
      {passkeys.length === 0 ? <p>No passkeys registered yet.</p> : (
        <ul className="securityFactorList">{passkeys.map((passkey) => (
          <li key={passkey.id}><span><Fingerprint aria-hidden="true" size={17} /> {passkey.friendly_name?.trim() || "Passkey"}</span><button className="secondaryButton" disabled={pending} onClick={() => void remove(passkey.id)} type="button">Remove</button></li>
        ))}</ul>
      )}
      <button className="primaryButton" disabled={pending} onClick={() => void register()} type="button"><Fingerprint aria-hidden="true" size={17} /> {pending ? "Waiting for device…" : "Create passkey"}</button>
      {error ? <p className="authMessage authMessageError" role="alert">{error}</p> : null}
    </section>
  );
}
