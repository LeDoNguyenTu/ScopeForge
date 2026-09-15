"use client";

import { useEffect, useState } from "react";
import AuthStatusCard, { type AuthResultStatus } from "@/components/auth/AuthStatusCard";

export default function AuthResultClient({ status }: { status: AuthResultStatus }) {
  const [displayStatus, setDisplayStatus] = useState(status);
  useEffect(() => {
    // Standard provider email links return failures in the URL fragment.
    // Only recognize bounded error codes; never render provider descriptions.
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    if (fragment.get("error_code") === "otp_expired") setDisplayStatus("expired");
    else if (fragment.has("error")) setDisplayStatus("invalid");
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);
  return <AuthStatusCard status={displayStatus} />;
}
