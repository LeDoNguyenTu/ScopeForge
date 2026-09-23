"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthenticatorFactor } from "@/lib/auth/assurance";
import { safeAuthReturnPath } from "@/lib/auth/return-path";
import { createClient } from "@/lib/supabase/client";

export default function MfaChallengeForm({ factors, next }: { factors: AuthenticatorFactor[]; next: string }) {
  const router = useRouter();
  const [factorId, setFactorId] = useState(factors[0]?.id ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const supabase = createClient();
    const result = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (result.error) {
      setError("That code could not be verified.");
      setPending(false);
      return;
    }
    router.replace(safeAuthReturnPath(next));
    router.refresh();
  }

  return (
    <form className="authForm" onSubmit={verify}>
      {factors.length > 1 ? (
        <label>Authenticator
          <select value={factorId} onChange={(event) => setFactorId(event.target.value)}>
            {factors.map((factor) => <option key={factor.id} value={factor.id}>{factor.friendlyName}</option>)}
          </select>
        </label>
      ) : null}
      <label htmlFor="mfa-code">Authentication code</label>
      <input
        autoComplete="one-time-code"
        id="mfa-code"
        inputMode="numeric"
        maxLength={6}
        pattern="[0-9]{6}"
        required
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
      />
      <button className="primaryButton authSubmit" disabled={pending || code.length !== 6 || !factorId} type="submit">
        {pending ? "Verifying…" : "Verify identity"}
      </button>
      {error ? <p className="authMessage" role="alert">{error}</p> : null}
    </form>
  );
}
