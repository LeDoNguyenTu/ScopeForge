"use client";

import { useState, useTransition } from "react";
import { runFindingRetestAction } from "@/app/dashboard/findings/[findingId]/remediation-actions";
import type {
  FindingLifecycleState,
  SecurityFindingRetestRow,
  WorkspaceRole,
} from "@/lib/database.types";
import type { RetestExecutionKind } from "@/lib/security-remediation/types";

export interface FindingRetestPanelProps {
  findingId: string;
  lifecycleState: FindingLifecycleState;
  role: WorkspaceRole;
  executionKind: RetestExecutionKind | null;
  retests: readonly SecurityFindingRetestRow[];
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Singapore",
  }).format(new Date(value));
}

function statusLabel(value: string): string {
  return value.replaceAll("_", " ");
}

export default function FindingRetestPanel({
  findingId,
  lifecycleState,
  role,
  executionKind,
  retests,
}: FindingRetestPanelProps) {
  const [consent, setConsent] = useState(false);
  const [history, setHistory] = useState<readonly SecurityFindingRetestRow[]>(retests);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canWrite = role !== "viewer";
  const activeAllowed = role === "owner" || role === "admin";
  const canRun = canWrite && lifecycleState === "resolved" && executionKind !== null;
  const activeBlockedByRole = executionKind === "active_validation" && !activeAllowed;

  function runRetest() {
    if (!canRun || activeBlockedByRole) return;
    if (executionKind === "active_validation" && !consent) return;

    setMessage(null);
    startTransition(async () => {
      const result = await runFindingRetestAction(
        findingId,
        executionKind === "active_validation" ? consent : false,
      );
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setHistory((current) => [result.data, ...current.filter((row) => row.id !== result.data.id)].slice(0, 50));
      setConsent(false);
      setMessage("Finding retest completed.");
    });
  }

  return (
    <article className="panel">
      <div className="panelTitle"><div><span>Verification</span><h2>Deterministic retest</h2></div></div>
      <div className="verificationPanel">
        {role === "viewer" ? (
          <div className="guardrail"><p><strong>Read-only.</strong> Your workspace role can review retest history but cannot start a retest.</p></div>
        ) : lifecycleState !== "resolved" ? (
          <div className="guardrail"><p>Resolve the finding before requesting a deterministic retest.</p></div>
        ) : executionKind === null ? (
          <div className="guardrail"><p>This finding does not have a supported deterministic retest source.</p></div>
        ) : activeBlockedByRole ? (
          <div className="guardrail"><p>Active validation can only be started by an owner or admin.</p></div>
        ) : (
          <>
            <p className="authMessage">
              {executionKind === "active_validation"
                ? "Runs the bounded CORS origin-policy validation using the existing server-controlled profile."
                : "Runs the existing bounded passive runtime observation with the server-controlled budget."}
            </p>
            {executionKind === "active_validation" ? (
              <label className="findingNoteField">
                <span>
                  <input
                    aria-label="Explicit consent for active validation"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    required
                    type="checkbox"
                  />{" "}I give explicit consent to run this bounded active validation.
                </span>
              </label>
            ) : null}
            <div className="heroActions">
              <button
                className="primaryButton compact"
                disabled={isPending || (executionKind === "active_validation" && !consent)}
                onClick={runRetest}
                type="button"
              >
                Run retest
              </button>
            </div>
          </>
        )}
        {message ? <div className="authMessage" role="status">{message}</div> : null}
      </div>

      <div className="auditList">
        {history.length > 0 ? history.map((retest) => (
          <div className="auditRow" key={retest.id}>
            <div>
              <strong>{statusLabel(retest.status)}</strong>
              <p>{statusLabel(retest.execution_kind)} · {retest.result_code ? statusLabel(retest.result_code) : "No terminal result yet"}</p>
            </div>
            <span className="modulePhase">{formatDate(retest.requested_at)}</span>
          </div>
        )) : <p className="authMessage">No deterministic retests have been recorded.</p>}
      </div>
    </article>
  );
}
