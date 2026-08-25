"use client";

import Link from "next/link";
import { useState } from "react";
import { FileClock, ShieldCheck, Upload } from "lucide-react";
import { PHASE3_IMPORT_MAX_BODY_BYTES } from "@/lib/phase3-import/transport";

export interface RepositoryImportHistoryItem {
  id: string;
  scanJobId: string;
  runRef: string;
  toolVersion: string;
  scanStartedAt: string;
  scanDurationMs: number;
  scannerErrorCount: number;
  filesAnalyzed: number;
  findingCount: number;
  createdAt: string;
}

interface RepositoryImportPanelProps {
  assetId: string;
  repositoryUrl: string;
  history: readonly RepositoryImportHistoryItem[];
}

type ImportResponse = {
  ok?: boolean;
  data?: {
    importRunId?: string;
    scanJobId?: string;
    replayed?: boolean;
  };
  error?: {
    code?: string;
    message?: string;
  };
};

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function safeResponse(value: unknown): ImportResponse | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as ImportResponse;
}

export default function RepositoryImportPanel({
  assetId,
  repositoryUrl,
  history,
}: RepositoryImportPanelProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cliCommand = `scopeforge scan . --format hosted-json --repository ${repositoryUrl} --output scopeforge-hosted.json`;

  async function uploadHostedResult() {
    setMessage(null);
    setErrorMessage(null);

    if (!selectedFile) {
      setErrorMessage("Choose a ScopeForge hosted JSON file before importing.");
      return;
    }
    if (selectedFile.size > PHASE3_IMPORT_MAX_BODY_BYTES) {
      setErrorMessage("The selected file exceeds the 3.5 MB import boundary.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/phase3-import?assetId=${encodeURIComponent(assetId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: selectedFile,
      });

      let parsed: unknown = null;
      try {
        parsed = await response.json();
      } catch {
        parsed = null;
      }
      const payload = safeResponse(parsed);

      if (!response.ok) {
        setErrorMessage(
          typeof payload?.error?.message === "string" && payload.error.message.length > 0
            ? payload.error.message
            : "The hosted Phase 3 import could not be completed safely.",
        );
        return;
      }

      setMessage(payload?.data?.replayed
        ? "This hosted result was already imported. No duplicate finding history was created."
        : "Hosted findings imported successfully. Refresh this asset to see the latest import history.");
    } catch {
      setErrorMessage("The hosted Phase 3 import could not be completed safely.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="verificationPanel">
      <div className="verificationHeader">
        <div>
          <span className="sectionEyebrow">Hosted Phase 3 import</span>
          <h2>Bring local repository findings into the canonical ledger</h2>
          <p>Run ScopeForge locally or in CI, then upload the privacy-reduced hosted JSON result for this exact repository asset.</p>
        </div>
        <Link className="secondaryButton compact" href="/dashboard/findings">
          View canonical findings
        </Link>
      </div>

      <div className="challengeBox">
        <div className="instructionStep">
          <span>1</span>
          <div>
            <strong>Generate a hosted result</strong>
            <p>Run this command from the repository root:</p>
            <code>{cliCommand}</code>
          </div>
        </div>
      </div>

      <div className="guardrail">
        <ShieldCheck size={17} />
        <p><strong>Privacy-reduced upload only.</strong> Hosted JSON excludes local scan roots, source snippets, data-flow traces, raw scanner diagnostics, secret values or secret hashes, and full SBOM bodies. Repository source code is not uploaded or executed by the hosted control plane.</p>
      </div>

      <div className="challengeBox">
        <div className="instructionStep">
          <span>2</span>
          <div>
            <strong>Upload the hosted JSON</strong>
            <p>The server revalidates the envelope, repository binding, scanner registry, identities, and 3.5 MB request limit before any trusted persistence.</p>
          </div>
        </div>
        <div>
          <label htmlFor="phase3-hosted-json">Hosted JSON file</label>
          <input
            accept="application/json,.json"
            id="phase3-hosted-json"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            type="file"
          />
        </div>
        <button
          className="primaryButton compact"
          disabled={busy}
          onClick={uploadHostedResult}
          type="button"
        >
          <Upload size={14} /> {busy ? "Importing..." : "Import hosted findings"}
        </button>
      </div>

      {message && <div className="authMessage" role="status">{message}</div>}
      {errorMessage && <div className="authMessage" role="alert">{errorMessage}</div>}

      <div className="verificationHeader">
        <div>
          <span className="sectionEyebrow">Import history</span>
          <h3>Recent repository imports</h3>
        </div>
        <FileClock size={18} />
      </div>

      {history.length === 0 ? (
        <div className="emptyCompact">No hosted Phase 3 imports have been recorded for this repository yet.</div>
      ) : (
        <div className="auditList">
          {history.map((item) => (
            <div className="auditRow" key={item.id}>
              <span className="auditDot" />
              <div>
                <strong>{countLabel(item.findingCount, "finding")} - {countLabel(item.filesAnalyzed, "file")} analyzed</strong>
                <small>{new Date(item.createdAt).toLocaleString()} - ScopeForge {item.toolVersion}</small>
                {item.scannerErrorCount > 0 && (
                  <small>{countLabel(item.scannerErrorCount, "scanner error")}</small>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
