"use client";

import { useState, useTransition } from "react";
import type { FindingLifecycleState, WorkspaceRole } from "@/lib/database.types";
import { changeFindingLifecycleAction } from "@/app/dashboard/findings/[findingId]/actions";
import type { Phase5ALifecycleAction } from "@/lib/security-findings/service";

const actionsByState = {
  open: ["acknowledge", "start_work"],
  acknowledged: ["start_work"],
  in_progress: ["resolve"],
  resolved: ["reopen"],
} as const satisfies Partial<Record<FindingLifecycleState, readonly Phase5ALifecycleAction[]>>;

const ACTION_LABELS: Readonly<Record<Phase5ALifecycleAction, string>> = Object.freeze({
  acknowledge: "Acknowledge",
  start_work: "Start work",
  resolve: "Resolve",
  reopen: "Reopen",
});

const WRITE_ROLES = new Set<WorkspaceRole>(["owner", "admin", "member"]);

export interface FindingLifecycleControlsProps {
  findingId: string;
  lifecycleState: FindingLifecycleState;
  role: WorkspaceRole;
}

export default function FindingLifecycleControls({
  findingId,
  lifecycleState,
  role,
}: FindingLifecycleControlsProps) {
  const [currentState, setCurrentState] = useState<FindingLifecycleState>(lifecycleState);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!WRITE_ROLES.has(role)) {
    return (
      <div className="guardrail">
        <p><strong>Read-only.</strong> Your workspace role can review this finding but cannot change its lifecycle.</p>
      </div>
    );
  }

  const actions = actionsByState[currentState as keyof typeof actionsByState] ?? [];
  if (actions.length === 0) {
    return (
      <div className="guardrail">
        <p><strong>Display-only state.</strong> No Phase 5A lifecycle action is available from the current state.</p>
      </div>
    );
  }

  const noteAction = actions.length === 1 && (actions[0] === "resolve" || actions[0] === "reopen")
    ? actions[0]
    : null;
  const noteRequired = noteAction !== null;

  function runAction(action: Phase5ALifecycleAction) {
    const actionNote = action === "resolve" || action === "reopen" ? note.trim() : undefined;
    if ((action === "resolve" || action === "reopen") && !actionNote) return;

    setMessage(null);
    startTransition(async () => {
      const result = await changeFindingLifecycleAction(findingId, action, actionNote);
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setCurrentState(result.data.lifecycleState as FindingLifecycleState);
      setNote("");
      setMessage("Finding lifecycle updated.");
    });
  }

  return (
    <div className="verificationPanel">
      <div className="verificationHeader">
        <div>
          <span className="sectionEyebrow">Lifecycle</span>
          <h3>Manage finding state</h3>
        </div>
      </div>

      {noteAction ? (
        <label className="findingNoteField">
          <span>{noteAction === "resolve" ? "Resolution note" : "Reopen note"}</span>
          <input
            aria-label={noteAction === "resolve" ? "Resolution note" : "Reopen note"}
            maxLength={1000}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add operator context"
            required={noteRequired}
            type="text"
            value={note}
          />
          <small>Required. Maximum 1000 characters.</small>
        </label>
      ) : null}

      <div className="heroActions">
        {actions.map((action) => (
          <button
            className={action === "resolve" ? "primaryButton compact" : "secondaryButton compact"}
            disabled={isPending || ((action === "resolve" || action === "reopen") && note.trim().length === 0)}
            key={action}
            onClick={() => runAction(action)}
            type="button"
          >
            {ACTION_LABELS[action]}
          </button>
        ))}
      </div>

      {message ? <div className="authMessage" role="status">{message}</div> : null}
    </div>
  );
}
