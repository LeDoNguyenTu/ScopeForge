"use client";

import { useState } from "react";
import { Check, Clipboard, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { createAssetVerificationChallenge, verifyAsset } from "@/app/dashboard/assets/actions";

export default function VerificationPanel({ assetId, status, kind }: { assetId: string; status: string; kind: string }) {
  const [challenge, setChallenge] = useState<{ token: string; expiresAt: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  if (status === "verified") {
    return <div className="verificationSuccess"><ShieldCheck size={20} /><div><strong>Control verified</strong><p>ScopeForge confirmed the verification token from the authorized target.</p></div></div>;
  }

  if (kind === "repository") {
    return <div className="guardrail"><KeyRound size={17} /><p><strong>Repository verification is not enabled yet.</strong> A GitHub-native proof-of-control flow will be introduced before repository scanning becomes available.</p></div>;
  }

  async function issueChallenge() {
    setBusy(true);
    setMessage(null);
    const result = await createAssetVerificationChallenge(assetId);
    setBusy(false);
    if (!result.ok) return setMessage(result.error.message);
    setChallenge(result.data);
  }

  async function verify() {
    if (!challenge) return;
    setBusy(true);
    setMessage(null);
    const result = await verifyAsset(assetId, challenge.token);
    setBusy(false);
    if (!result.ok) return setMessage(result.error.message);
    setMessage(result.data.reason);
    if (result.data.verified) window.location.reload();
  }

  async function copyToken() {
    if (!challenge) return;
    await navigator.clipboard.writeText(challenge.token);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="verificationPanel">
      <div className="verificationHeader">
        <div><span className="sectionEyebrow">Proof of control</span><h2>Verify before security testing</h2><p>ScopeForge will make one bounded HTTPS request to a fixed well-known path. This verifies control of the target, not legal ownership.</p></div>
        {!challenge && <button className="primaryButton compact" disabled={busy} onClick={issueChallenge} type="button">{busy ? "Creating..." : "Create challenge"}</button>}
      </div>

      {challenge && <div className="challengeBox">
        <div className="instructionStep"><span>1</span><div><strong>Create this file on your target</strong><code>/.well-known/scopeforge-verification.txt</code></div></div>
        <div className="instructionStep"><span>2</span><div><strong>Put this exact one-time token in the file</strong><div className="tokenRow"><code>{challenge.token}</code><button aria-label="Copy verification token" onClick={copyToken} type="button">{copied ? <Check size={15} /> : <Clipboard size={15} />}</button></div></div></div>
        <div className="instructionStep"><span>3</span><div><strong>Verify the target</strong><p>Challenge expires {new Date(challenge.expiresAt).toLocaleString()}. The plaintext token is returned only for this session. ScopeForge stores its SHA-256 hash.</p><button className="primaryButton compact" disabled={busy} onClick={verify} type="button"><RefreshCw size={14} /> {busy ? "Verifying..." : "Verify control"}</button></div></div>
        <p className="fieldHelp">You can remove the verification file after control is confirmed.</p>
      </div>}

      {message && <div className="authMessage" role="status">{message}</div>}
    </div>
  );
}
