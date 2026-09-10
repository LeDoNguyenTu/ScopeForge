"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GitBranch, ScanSearch, ShieldCheck } from "lucide-react";
import { requestConnectedProjectSecurityScan } from "@/app/dashboard/assets/[assetId]/project-scan-actions";
import type { WorkspaceRole } from "@/lib/database.types";
import type { ConnectedProjectScanReadModel } from "@/lib/project-scans/read-model";

interface ConnectedProjectScanPanelProps {
  assetId: string;
  role: WorkspaceRole;
  project: ConnectedProjectScanReadModel;
  snapshotRuntimeAvailable: boolean;
  scanRuntimeAvailable: boolean;
}

const ACTIVE_STATES = new Set<ConnectedProjectScanReadModel["projectScanState"]>([
  "snapshot_queued",
  "waiting_scan_runtime",
  "scan_queued",
  "retry_pending",
]);

function stateMessage(state: ConnectedProjectScanReadModel["projectScanState"]): string | null {
  switch (state) {
    case "snapshot_queued":
      return "An immutable source snapshot is queued. ScopeForge will continue the project scan after publication.";
    case "waiting_scan_runtime":
      return "The immutable source snapshot is ready and the project is waiting safely for the repository scan runtime.";
    case "scan_queued":
      return "The repository scan is queued. ScopeForge will publish findings when the bounded worker completes.";
    case "retry_pending":
      return "The project scan continuation is pending a safe retry. A duplicate user start is not required.";
    default:
      return null;
  }
}

function actionLabel(
  role: WorkspaceRole,
  project: ConnectedProjectScanReadModel,
  snapshotRuntimeAvailable: boolean,
): string {
  if (role !== "owner" && role !== "admin") return "Owner or admin required";
  if (project.isPrivate) return "Private acquisition required";
  if (project.accessStatus !== "active") return "GitHub access inactive";
  if (project.projectScanState === "snapshot_queued") return "Snapshot queued";
  if (project.projectScanState === "waiting_scan_runtime") return "Waiting for scan runtime";
  if (project.projectScanState === "scan_queued") return "Scan queued";
  if (project.projectScanState === "retry_pending") return "Retry pending";
  if (!snapshotRuntimeAvailable) return "Snapshot runtime unavailable";
  return "Scan project";
}

export default function ConnectedProjectScanPanel({
  assetId,
  role,
  project,
  snapshotRuntimeAvailable,
  scanRuntimeAvailable,
}: ConnectedProjectScanPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canManage = role === "owner" || role === "admin";
  const orchestrationActive = ACTIVE_STATES.has(project.projectScanState);
  const disabled = pending
    || !canManage
    || project.isPrivate
    || project.accessStatus !== "active"
    || orchestrationActive
    || !snapshotRuntimeAvailable;
  const currentStateMessage = stateMessage(project.projectScanState);

  function requestScan() {
    if (disabled) return;
    setMessage(null);
    setErrorMessage(null);
    startTransition(async () => {
      const result = await requestConnectedProjectSecurityScan(assetId);
      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }
      setMessage(result.message);
      if (result.status === "snapshot_queued") router.refresh();
    });
  }

  return (
    <div className="verificationPanel">
      <div className="verificationHeader">
        <div>
          <span className="sectionEyebrow">Connected project</span>
          <h2>Scan the repository as one ScopeForge project</h2>
          <p>ScopeForge keeps source acquisition and scanner execution separated internally while presenting one project-level action.</p>
        </div>
        <ScanSearch size={20} />
      </div>

      <div className="detailList">
        <div><dt>GitHub repository</dt><dd>{project.fullName}</dd></div>
        <div><dt>Repository access</dt><dd>{project.accessStatus}</dd></div>
        <div><dt>Visibility</dt><dd>{project.isPrivate ? "Private" : "Public"}</dd></div>
        <div><dt>Branch</dt><dd><GitBranch size={13} /> Default branch: {project.defaultBranch}</dd></div>
      </div>

      <div className="guardrail">
        <ShieldCheck size={17} />
        <p>
          <strong>Bounded orchestration.</strong>{" "}
          {project.isPrivate
            ? "Private repository acquisition remains Phase 10A2 work. The GitHub connection is retained, but Phase 10A1 will not route private source into the public acquisition worker."
            : !snapshotRuntimeAvailable
              ? "Hosted source acquisition is still gated in this deployment, so starting a project scan is disabled."
              : scanRuntimeAvailable
                ? "A click queues an immutable public source snapshot and the repository scan continues automatically after publication."
                : "A click queues the immutable public source snapshot now; the scan will wait safely until the repository scan runtime is enabled."}
        </p>
      </div>

      {currentStateMessage && <div className="emptyCompact">{currentStateMessage}</div>}
      {!canManage && (
        <div className="emptyCompact">Your workspace role is read-only for connected project scans. An owner or admin can start a new scan.</div>
      )}
      {project.accessStatus !== "active" && (
        <div className="emptyCompact">GitHub access is no longer active for this repository. Reconnect or restore repository access before scanning.</div>
      )}

      <button
        className="primaryButton compact"
        disabled={disabled}
        onClick={requestScan}
        type="button"
      >
        <ScanSearch size={14} /> {pending ? "Queueing project scan..." : actionLabel(role, project, snapshotRuntimeAvailable)}
      </button>

      {message && <div className="authMessage" role="status">{message}</div>}
      {errorMessage && <div className="authMessage" role="alert">{errorMessage}</div>}
    </div>
  );
}
