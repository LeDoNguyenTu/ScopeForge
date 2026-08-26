"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, Clock3, GitCommitHorizontal, ShieldCheck } from "lucide-react";
import { requestRepositorySnapshot } from "@/app/dashboard/assets/[assetId]/snapshot-actions";
import type { WorkspaceRole } from "@/lib/database.types";
import type { RepositorySnapshotHistoryItem } from "@/lib/repository-snapshots/read-model";

interface RepositorySnapshotPanelProps {
  assetId: string;
  role: WorkspaceRole;
  history: readonly RepositorySnapshotHistoryItem[];
}

function bytesLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export default function RepositorySnapshotPanel({
  assetId,
  role,
  history,
}: RepositorySnapshotPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canRequest = role === "owner" || role === "admin";

  function requestSnapshot() {
    setMessage(null);
    setErrorMessage(null);
    startTransition(async () => {
      const result = await requestRepositorySnapshot(assetId);
      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }
      setMessage("Snapshot request queued. Refreshing repository provenance...");
      router.refresh();
    });
  }

  return (
    <div className="verificationPanel">
      <div className="verificationHeader">
        <div>
          <span className="sectionEyebrow">Private source snapshot</span>
          <h2>Acquire an immutable public GitHub source snapshot</h2>
          <p>ScopeForge resolves the current public GitHub default branch to an exact commit, normalizes the source into a private seven-day artifact, and records safe provenance.</p>
        </div>
        <Archive size={20} />
      </div>

      <div className="guardrail">
        <ShieldCheck size={17} />
        <p><strong>Acquisition is not scanning.</strong> This boundary does not run package scripts, builds, Git hooks, submodules, Git LFS fetches, or repository code. Security scanning remains a separate Phase 6C execution boundary.</p>
      </div>

      {canRequest ? (
        <div className="challengeBox">
          <div className="instructionStep">
            <span>1</span>
            <div>
              <strong>Create a bounded source snapshot</strong>
              <p>The repository URL, default branch, immutable commit, execution profile, network policy, and storage location are derived by trusted ScopeForge services. There are no caller-configurable acquisition fields.</p>
            </div>
          </div>
          <button
            className="primaryButton compact"
            disabled={pending}
            onClick={requestSnapshot}
            type="button"
          >
            <Archive size={14} /> {pending ? "Queueing snapshot..." : "Create private source snapshot"}
          </button>
        </div>
      ) : (
        <div className="emptyCompact">Snapshot history is read-only for your workspace role. Owners and admins can request new hosted source snapshots.</div>
      )}

      {message && <div className="authMessage" role="status">{message}</div>}
      {errorMessage && <div className="authMessage" role="alert">{errorMessage}</div>}

      <div className="verificationHeader">
        <div>
          <span className="sectionEyebrow">Snapshot history</span>
          <h3>Recent immutable repository provenance</h3>
        </div>
        <Clock3 size={18} />
      </div>

      {history.length === 0 ? (
        <div className="emptyCompact">No private source snapshots have been published for this repository yet.</div>
      ) : (
        <div className="auditList">
          {history.map((item) => {
            const expired = new Date(item.expiresAt).getTime() <= Date.now();
            return (
              <div className="auditRow" key={item.id}>
                <span className="auditDot" />
                <div>
                  <strong><GitCommitHorizontal size={13} /> {item.resolvedCommitSha.slice(0, 12)} on {item.defaultBranch}</strong>
                  <small>{item.retainedFileCount} retained files - {bytesLabel(item.retainedBytes)} source - {bytesLabel(item.storedArtifactBytes)} private artifact</small>
                  <small>Created {new Date(item.createdAt).toLocaleString()} - {expired ? "artifact retention expired" : `artifact expires ${new Date(item.expiresAt).toLocaleString()}`}</small>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
