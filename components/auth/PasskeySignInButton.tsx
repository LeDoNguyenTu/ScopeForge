"use client";

import { useState } from "react";
import { Fingerprint } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function PasskeySignInButton({ captchaToken = null, captchaRequired = false, onAttemptComplete }: {
  captchaToken?: string | null;
  captchaRequired?: boolean;
  onAttemptComplete?: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    setPending(true);
    setError("");
    try {
      const result = await createClient().auth.signInWithPasskey(
        captchaToken ? { options: { captchaToken } } : undefined,
      );
      if (result.error) throw result.error;
      window.location.assign("/dashboard");
    } catch {
      setError("Passkey sign-in is unavailable or was cancelled.");
      setPending(false);
    } finally {
      onAttemptComplete?.();
    }
  }

  return (
    <div className="passkeySignIn">
      <button className="secondaryButton passkeySignInButton" disabled={pending || (captchaRequired && !captchaToken)} onClick={() => void signIn()} type="button">
        <Fingerprint aria-hidden="true" size={18} />{pending ? "Waiting for passkey…" : "Continue with a passkey"}
      </button>
      {error ? <p className="authMessage authMessageError" role="alert">{error}</p> : null}
    </div>
  );
}
