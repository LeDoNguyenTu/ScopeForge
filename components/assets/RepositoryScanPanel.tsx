"use client";

import { Cpu, GitCommitHorizontal, ShieldCheck } from "lucide-react";
import type {
  RepositoryScanHistoryItem,
  RepositoryScanJobSummary,
} from "@/lib/repository-scans/read-model";

interface RepositoryScanPanelProps {
  latestJob: RepositoryScanJobSummary | null;
  history: readonly RepositoryScanHistoryItem[];
}

function bytesLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function jobStatus(job: RepositoryScanJobSummary | null): string {
  if (!job) return "No hosted scan has been queued yet.";
  if (job.cancelRequestedAt) return `Latest job: ${job.status} - cancellation requested`;
  if (job.failureCode) return `Latest job: ${job.status} - ${job.failureCode}`;
  return `Latest job: ${job.status}`;
}

export default function RepositoryScanPanel({
  latestJob,
  history,
}: RepositoryScanPanelProps) {
  return (
    <div className="verificationPanel">
      <div className="verificationHeader">
        <div>
          <span className="sectionEyebrow">Hosted repository scan</span>
          <h2>Zero-egress static analysis</h2>
          <p>ScopeForge will scan a previously published immutable repository snapshot with the fixed hosted Phase 3 scanner profile inside an isolated no-network worker.</p>
        </div>
        <Cpu size={20} />
      </div>

      <div className="guardrail">
        <ShieldCheck size={17} />
        <p><strong>Runtime unavailable.</strong> Hosted repository scanning remains disabled until a real Linux worker proves the rootless Podman, cgroup v2, no-network, read-only source, resource-limit, and cancellation guarantees. Source acquisition and existing scan history remain available independently.</p>
      </div>

      <div className="challengeBox">
        <div className="instructionStep">
          <span>1</span>
          <div>
            <strong>Request the fixed hosted scan</strong>
            <p>The browser cannot select a snapshot, scanner profile, execution class, budget, image, command, network policy, or storage location. Trusted services select the newest eligible immutable source snapshot and fixed profile.</p>
          </div>
        </div>
        <button className="primaryButton compact" disabled type="button" aria-disabled="true">
          <Cpu size={14} /> Runtime unavailable
        </button>
        <div className="emptyCompact">{jobStatus(latestJob)}</div>
      </div>

      <div className="verificationHeader">
        <div>
          <span className="sectionEyebrow">Scan history</span>
          <h3>Published hosted scan provenance</h3>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="emptyCompact">No hosted repository scan runs have been published for this asset.</div>
      ) : (
        <div className="auditList">
          {history.map((item) => (
            <div className="auditRow" key={item.id}>
              <span className="auditDot" />
              <div>
                <strong><GitCommitHorizontal size={13} /> {item.resolvedCommitSha.slice(0, 12)} - {item.findingCount} findings</strong>
                <small>{item.scannerProfileId} v{item.scannerProfileVersion} - ScopeForge {item.toolVersion} - {item.filesAnalyzed} files analyzed - {bytesLabel(item.totalBytes)}</small>
                <small>Run {item.runRef.slice(0, 18)}... - started {new Date(item.scanStartedAt).toLocaleString()} - duration {item.scanDurationMs} ms</small>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
