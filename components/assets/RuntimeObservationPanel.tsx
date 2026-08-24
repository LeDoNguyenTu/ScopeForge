"use client";

import { useState } from "react";
import { Ban, RefreshCw, ShieldCheck, StopCircle } from "lucide-react";
import {
  cancelPassiveRuntimeObservation,
  runPassiveRuntimeObservation,
} from "@/app/dashboard/assets/[assetId]/runtime-actions";
import type {
  AssetKind,
  AssetVerificationStatus,
  ScanJobStatus,
} from "@/lib/database.types";

export interface RuntimeObservationPanelJob {
  id: string;
  status: ScanJobStatus;
  blockedReason: string | null;
  failureCode: string | null;
  requestCount: number;
  redirectCount: number;
  findingCount: number;
  cancelRequestedAt: string | null;
}

export interface RuntimeObservationPanelObservation {
  kind: string;
  name?: string;
  present?: boolean;
  value?: string;
  protocol?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  subjectAltName?: string | null;
  status?: number;
}

interface RuntimeObservationPanelProps {
  assetId: string;
  assetKind: AssetKind;
  verificationStatus: AssetVerificationStatus;
  latestJob: RuntimeObservationPanelJob | null;
  observations: readonly RuntimeObservationPanelObservation[];
}

const SAFE_FAILURE_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  RUNTIME_AUTHORIZATION_CHANGED: "The asset authorization changed before execution.",
  RUNTIME_ASSET_UNVERIFIED: "The asset is no longer verified for passive observation.",
  RUNTIME_ASSET_NOT_AVAILABLE: "The asset is no longer available in this workspace.",
  RUNTIME_WORKSPACE_DENIED: "The asset is no longer authorized in this workspace.",
  RUNTIME_CANCELLATION_REQUESTED: "The passive observation was cancelled before network execution.",
  NETWORK_ERROR: "The passive observation could not complete because of a network error.",
  REQUEST_TIMEOUT: "The passive observation stopped after a request timeout.",
  TOTAL_TIMEOUT: "The passive observation stopped after reaching its total time budget.",
  OBSERVATION_BUDGET: "The passive observation stopped after reaching its bounded observation budget.",
  RUNTIME_EXECUTION_ERROR: "The passive observation could not complete safely.",
});

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function safeTerminalMessage(job: RuntimeObservationPanelJob): string {
  if (job.status === "cancelled") return "The passive observation was cancelled.";
  if (job.failureCode && SAFE_FAILURE_MESSAGES[job.failureCode]) {
    return SAFE_FAILURE_MESSAGES[job.failureCode];
  }
  if (job.status === "blocked") {
    return "The passive observation was blocked because the authorization boundary was no longer valid.";
  }
  return "The passive observation could not complete safely.";
}

export default function RuntimeObservationPanel({
  assetId,
  assetKind,
  verificationStatus,
  latestJob: initialJob,
  observations,
}: RuntimeObservationPanelProps) {
  const [latestJob, setLatestJob] = useState(initialJob);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (assetKind === "repository") {
    return (
      <div className="guardrail">
        <Ban size={17} />
        <p><strong>Runtime observation unavailable.</strong> Repository assets are not supported by passive runtime observations.</p>
      </div>
    );
  }

  if (verificationStatus !== "verified") {
    return (
      <div className="guardrail">
        <ShieldCheck size={17} />
        <p><strong>Verification required.</strong> Verify this asset before running a passive observation.</p>
      </div>
    );
  }

  const active = latestJob?.status === "queued" || latestJob?.status === "running";
  const headerObservations = observations.filter(
    (observation) => observation.kind === "header" && typeof observation.name === "string",
  );
  const tlsObservation = observations.find((observation) => observation.kind === "tls");

  async function runObservation() {
    setBusy(true);
    setMessage(null);
    const result = await runPassiveRuntimeObservation(assetId);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    setLatestJob(result.data.job);
    window.location.reload();
  }

  async function cancelObservation() {
    if (!latestJob) return;
    setBusy(true);
    setMessage(null);
    const result = await cancelPassiveRuntimeObservation(latestJob.id);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    setLatestJob(result.data.job);
    setMessage(result.data.status === "cancelled"
      ? "Passive observation cancelled."
      : "Cancellation requested. The executor will stop before persistence when it reaches the cancellation boundary.");
  }

  return (
    <div className="verificationPanel">
      <div className="verificationHeader">
        <div>
          <span className="sectionEyebrow">Passive runtime observation</span>
          <h2>Bounded HTTPS and TLS checks</h2>
          <p>HTTPS only on port 443 with GET requests, fresh DNS classification, pinned connections, and same-host redirects. No crawling, fuzzing, authentication replay, or exploit payloads.</p>
        </div>
        {!active && (
          <button className="primaryButton compact" disabled={busy} onClick={runObservation} type="button">
            <RefreshCw size={14} /> {busy ? "Running..." : "Run passive observation"}
          </button>
        )}
      </div>

      {active && latestJob && (
        <div className="challengeBox">
          <div className="instructionStep">
            <span>1</span>
            <div>
              <strong>Job status: {latestJob.status}</strong>
              <p>The authorization snapshot is checked again immediately before any network request.</p>
            </div>
          </div>
          <button className="secondaryButton compact" disabled={busy} onClick={cancelObservation} type="button">
            <StopCircle size={14} /> {busy ? "Cancelling..." : "Cancel passive observation"}
          </button>
        </div>
      )}

      {latestJob?.status === "succeeded" && (
        <div className="challengeBox">
          <dl className="detailList">
            <div><dt>Requests</dt><dd>{countLabel(latestJob.requestCount, "request")}</dd></div>
            <div><dt>Redirects</dt><dd>{countLabel(latestJob.redirectCount, "redirect")}</dd></div>
            <div><dt>Findings</dt><dd>{countLabel(latestJob.findingCount, "finding")}</dd></div>
            <div><dt>TLS</dt><dd>{tlsObservation?.protocol ?? "No TLS metadata recorded"}</dd></div>
          </dl>

          {(headerObservations.length > 0 || tlsObservation) && (
            <div className="auditList">
              {headerObservations.map((observation, index) => (
                <div className="auditRow" key={`${observation.name}-${index}`}>
                  <span className="auditDot" />
                  <div><strong>{observation.name}: {observation.present ? "present" : "missing"}</strong></div>
                </div>
              ))}
              {tlsObservation && (
                <div className="auditRow">
                  <span className="auditDot" />
                  <div>
                    <strong>{tlsObservation.protocol ?? "TLS protocol unavailable"}</strong>
                    {tlsObservation.validTo && <small>Certificate valid to {new Date(tlsObservation.validTo).toLocaleString()}</small>}
                  </div>
                </div>
              )}
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
