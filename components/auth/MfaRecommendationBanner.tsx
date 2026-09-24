"use client";

import Link from "next/link";
import { ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";

const DISMISSED_KEY = "scopeforge:mfa-recommendation-dismissed";

export default function MfaRecommendationBanner({ role }: { role: string }) {
  const [visible, setVisible] = useState(false);
  const optionalForRole = role !== "platform-admin";

  useEffect(() => {
    if (!optionalForRole) return;
    try {
      if (window.sessionStorage.getItem(DISMISSED_KEY) === "true") return;
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }

    let active = true;
    let verified = false;
    let unsubscribe: (() => void) | undefined;
    void import("@/lib/supabase/client").then(({ createClient }) => {
      if (!active) return;
      const { auth } = createClient();
      const { data } = auth.onAuthStateChange((event) => {
        if (event === "MFA_CHALLENGE_VERIFIED" || event === "SIGNED_OUT") {
          verified = true;
          if (active) setVisible(false);
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
      return auth.mfa.listFactors();
    }).then((result) => {
      if (!active || verified || !result || result.error) return;
      const hasVerifiedTotp = (result.data?.totp ?? []).some((factor) => factor.status === "verified");
      setVisible(!hasVerifiedTotp);
    }).catch(() => { /* A recommendation must not interrupt workspace access. */ });
    return () => { active = false; unsubscribe?.(); };
  }, [optionalForRole]);

  function dismiss() {
    setVisible(false);
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, "true");
    } catch {
      // The in-memory dismissal still applies for the current page.
    }
  }

  if (!visible) return null;
  return (
    <aside className="workspaceMfaRecommendation" role="status" aria-label="Two-step verification recommendation">
      <ShieldCheck aria-hidden="true" size={19} />
      <p><strong>Protect your account with two-step verification.</strong> Recommended for your role, but it will not block workspace access. <Link href="/dashboard/settings/security">Set up two-step verification</Link></p>
      <button type="button" aria-label="Dismiss MFA recommendation" onClick={dismiss}><X aria-hidden="true" size={16} /></button>
    </aside>
  );
}
