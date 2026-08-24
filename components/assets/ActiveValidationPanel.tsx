"use client";

import { useState } from "react";
import { AlertTriangle, ShieldCheck, StopCircle, Zap } from "lucide-react";
import {
  cancelActiveValidation,
  runCorsOriginPolicyValidation,
} from "@/app/dashboard/assets/[assetId]/active-validation-actions";
import type {
  AssetKind,
  AssetVerificationStatus,
  ScanJobStatus,
  WorkspaceRole,
} from "@/lib/database.types";

export interface ActiveValidationPanelJob {
  id: string;
  status: ScanJobStatus;
  blockedReason: string | null;
  failureCode: string | null;
  requestCount: number;
  findingCount: number;
  cancelRequestedAt: string | null;
}

export interface ActiveValidationPanelObservation {
  kind: "cors-policy";
  url: string;
  status: number;
  allowedOrigin: string | null;
  credentialsAllowed: boolean;
  variesOnOrigin: boolean;
}

interface ActiveValidationPanelProps {
  assetId: string;
  assetKind: AssetKind;
  verificationStatus: AssetVerificationStatus;
  role: WorkspaceRole;
  latestJob: ActiveValidationPanelJob | null;
  observation: ActiveValidationPanelObservation | null;
}

const SAFE_FAILURE_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  ACTIVE_AUTHORIZATION_CHANGED: "The asset authorization changed before active execution.",
  ACTIVE_ASSET_UNVERIFIED: "The asset is no longer verified for active validation.",
  ACTIVE_ASSET_NOT_AVAILABLE: "The asset is no longer available in this workspace.",
  ACTIVE_WORKSPACE_DENIED: "Only workspace owners and admins can authorize bounded active validation.",
  ACTIVE_EXPLICIT_AUTHORIZATION_REQUIRED: "Explicit authorization is required for this active request.",
  ACTIVE_PROFILE_INVALID: "The built-in active validation profile no longer matches the approved profile.",
  ACTIVE_CANCELLATION_REQUESTED: "The active validation was cancelled before network execution.",
  NETWORK_ERROR: "The active validation could not complete because of a network error.",
  REQUEST_TIMEOUT: "The active validation stopped after a request timeout.",
  TOTAL_TIMEOUT: "The active validation stopped after reaching its total time budget.",
  ACTIVE_EXECUTION_ERROR: "The bounded active validation could not complete safely.",
});

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function safeTerminalMessage(job: ActiveValidationPanelJob): string {
  if (job.status === "cancelled") return "The active validation was cancelled.";
  if (job.failureCode && SAFE_FAILURE_MESSAGES[job.failureCode]) {
    return SAFE_FAILURE_MESSAGES[job.failureCode];
  }
  if (job.status === "blocked") {
    return "The active validation was blocked because its authorization boundary was no longer valid.";
  }
  return "The bounded active validation could not complete safely.";
}

export default function ActiveValidationPanel({
  assetId,
  assetKind,
  verificationStatus,
  role,
  latestJob: initialJob,
  observation,
}: ActiveValidationPanelProps) {
  const [latestJob, setLatestJob] = useState(initialJob);
  const [explicitConsent, setExplicitConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (assetKind === "repository") {
    return (
      <div className="guardrail">
        <AlertTriangle size={17} />
        <p><strong>Active validation unavailable.</strong> Repository assets are not supported by bounded active validation.</p>
      </div>
    );
  }

  if (verificationStatus !== "verified") {
    return (
      <div className="guardrail">
        <ShieldCheck size={17} />
        <p><strong>Verification required.</strong> Verify this asset before authorizing active validation.</p>
      </div>
    );
  }

  if (role !== "owner" && role !== "admin") {
    return (
      <div className="guardrail">
        <ShieldCheck size={17} />
        <p><strong>Owner or admin required.</strong> Only workspace owners and admins can authorize bounded active validation.</p>
      </div>
    );
  }

  const active = latestJob?.status === "queued" || latestJob?.status === "running";

  async function runValidation() {
    if (!explicitConsent || active) return;
    setBusy(true);
    setMessage(null);
    const result = await runCorsOriginPolicyValidation(assetId, explicitConsent);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    setLatestJob(result.data.job);
    setExplicitConsent(false);
    window.location.reload();
  }

  async function cancelValidation() {
    if (!latestJob || !active) return;
    setBusy(true);
    setMessage(null);
    const result = await cancelActiveValidation(latestJob.id);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    setLatestJob(result.data.job);
    setMessage(result.data.status === "cancelled"
      ? "Active validation cancelled."
      : "Cancellation requested. The executor will stop at the next cancellation boundary.");
  }

  return (
    <div className="verificationPanel">
      <div className="verificationHeader">
        <div>
          <span className="sectionEyebrow">Bounded active validation</span>
          <h2>CORS origin-policy check</h2>
          <p>
            Exactly one unauthenticated GET is sent to the exact verified HTTPS target with the fixed synthetic
            Origin https://scopeforge.invalid. No request body, cookies, credentials, redirect following, crawling,
            fuzzing, or exploit payloads.
          </p>
        </div>
      </div>

      {!active && (
        <div className="challengeBox">
          <label className="consentRow">
            <input
              checked={explicitConsent}
              disabled={busy}
              onChange={(event) => setExplicitConsent(event.target.checked)}
              type="checkbox"
            />
            <span>I authorize this one bounded active validation request.</span>
          </label>
          <button
            className="primaryButton compact"
            disabled={busy || !explicitConsent}
            onClick={runValidation}
            type="button"
          >
            <Zap size={14} /> {busy ? "Running..." : "Authorize and run CORS check"}
          </button>
        </div>
      )}

      {active && latestJob && (
        <div className="challengeBox">
          <div className="instructionStep">
            <span>1</span>
            <div>
              <strong>Active job status: {latestJob.status}</strong>
              <p>The immutable authorization snapshot is rechecked before DNS and network activity.</p>
            </div>
          </div>
          <button
            className="secondaryButton compact"
            disabled={busy}
            onClick={cancelValidation}
            type="button"
          >
            <StopCircle size={14} /> {busy ? "Cancelling..." : "Cancel active validation"}
          </button>
        </div>
      )}

      {latestJob?.status === "succeeded" && (
        <div className="challengeBox">
          <dl className="detailList">
            <div><dt>Requests</dt><dd>{countLabel(latestJob.requestCount, "request")}</dd></div>
            <div><dt>Findings</dt><dd>{countLabel(latestJob.findingCount, "finding")}</dd></div>
          </dl>

          {observation && (
            <div className="auditList">
              <div className="auditRow">
                <span className="auditDot" />
                <div>
                  <strong>Allowed origin</strong>
                  <small>{observation.allowedOrigin ?? "not returned"}</small>
                </div>
              </div>
              <div className="auditRow">
                <span className="auditDot" />
                <div><strong>{observation.credentialsAllowed ? "Credentials allowed" : "Credentials not allowed"}</strong></div>
              </div>
              <div className="auditRow">
                <span className="auditDot" />
                <div><strong>{observation.variesOnOrigin ? "Varies on Origin" : "Does not vary on Origin"}</strong></div>
              </div>
            </div>
          )}
        </div>
      )}

      {latestJob && ["failed", "blocked", "cancelled"].includes(latestJob.status) && (
        <div className="authMessage" role="status">{safeTerminalMessage(latestJob)}</div>
      )}

      {message && <div className="authMessage" role="status">{message}</div>}
    </div>
  );
}
