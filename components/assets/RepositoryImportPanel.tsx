"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileClock, ShieldCheck, Upload } from "lucide-react";
import { PHASE3_IMPORT_MAX_BODY_BYTES } from "@/lib/phase3-import/transport";
import { useToast } from "@/components/feedback/ToastProvider";

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
  const router = useRouter();
  const toast = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cliCommand = `npm run scopeforge -- scan /path/to/your-repository --format hosted-json --repository ${repositoryUrl} --output scopeforge-hosted.json`;

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(cliCommand);
      toast.success("Command copied. Replace /path/to/your-repository with your local repository folder.");
    } catch {
      toast.error("Could not copy. Select and copy the command below.");
    }
  }

  async function uploadHostedResult() {
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

      toast.success(payload?.data?.replayed
        ? "This hosted result was already imported. No duplicate finding history was created."
        : "Hosted findings imported successfully. Import history is updating.");
      router.refresh();
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
          <span className="sectionEyebrow">Local scan results</span>
          <h2>Import a scan you already ran</h2>
          <p>This is an optional local or CI workflow, not a required verification step. It uploads a results file; it does not scan GitHub or accept a source-code ZIP.</p>
        </div>
        <Link className="secondaryButton compact" href="/dashboard/findings">
          View canonical findings
        </Link>
      </div>

      <div className="challengeBox">
        <div className="instructionStep">
          <span>1</span>
          <div>
            <strong>Generate the results file on your computer</strong>
            <p>First follow the <Link href="/dashboard/resources">ScopeForge local scanning guide</Link>. From your ScopeForge tool folder, run this command. Replace <code>/path/to/your-repository</code> with the local folder containing this repository; quote paths containing spaces.</p>
            <code>{cliCommand}</code>
            <button className="secondaryButton compact" type="button" onClick={() => void copyCommand()}>Copy command</button>
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
            <strong>Select the generated scopeforge-hosted.json file</strong>
            <p>Find the output file in your ScopeForge tool folder. We validate that the results belong to this repository before saving them.</p>
          </div>
        </div>
        <div className="hostedFileField">
          <label htmlFor="phase3-hosted-json">Hosted JSON file</label>
          <input
            accept="application/json,.json"
            aria-describedby="hosted-json-help"
            disabled={busy}
            id="phase3-hosted-json"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            type="file"
          />
          <small id="hosted-json-help">ScopeForge hosted JSON only · maximum 3.5 MB. Do not select your source files or a repository archive.</small>
        </div>
        <button
          className="primaryButton compact"
          disabled={busy || !selectedFile}
          onClick={uploadHostedResult}
          type="button"
        >
          <Upload size={14} /> {busy ? "Importing..." : "Import hosted findings"}
        </button>
      </div>

      {errorMessage && <div className="authMessage" role="alert">{errorMessage}</div>}

      <div className="verificationHeader">
        <div>
          <span className="sectionEyebrow">Import history</span>
          <h3>Recent repository imports</h3>
        </div>
        <FileClock size={18} />
      </div>

      {history.length === 0 ? (
        <div className="emptyCompact">No local results imported yet. Connected GitHub scans have their own history above.</div>
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
