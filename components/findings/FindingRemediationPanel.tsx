"use client";

import { useState, useTransition } from "react";
import { updateFindingRemediationAction } from "@/app/dashboard/findings/[findingId]/remediation-actions";
import type { SecurityFindingWorkRow, WorkspaceRole } from "@/lib/database.types";

export interface FindingRemediationPanelProps {
  assignees?: Array<{ userId: string; label: string; detail?: string }>;
  findingId: string;
  role: WorkspaceRole;
  work: SecurityFindingWorkRow | null;
  currentUserId?: string;
}

export default function FindingRemediationPanel({
  assignees = [],
  findingId,
  role,
  work,
  currentUserId,
}: FindingRemediationPanelProps) {
  const [note, setNote] = useState(work?.remediation_note ?? "");
  const [assigneeUserId, setAssigneeUserId] = useState(work?.assignee_user_id ?? "");
  const [assignedToMe, setAssignedToMe] = useState(
    Boolean(currentUserId && work?.assignee_user_id === currentUserId),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (role === "viewer") {
    return (
      <article className="panel findingRemediationPanel">
        <div className="panelTitle"><div><span>Operator workflow</span><h2>Remediation work</h2></div></div>
        <div className="guardrail">
          <p><strong>Read-only.</strong> Your workspace role can review remediation work but cannot modify it.</p>
        </div>
        <div className="detailList">
          <div><span>Assignee</span><strong>{work?.assignee_user_id === currentUserId ? "You" : work?.assignee_user_id ? "Workspace member" : "Unassigned"}</strong></div>
          <div><span>Remediation note</span><strong>{work?.remediation_note ?? "No operator note yet."}</strong></div>
        </div>
      </article>
    );
  }

  function save() {
    const selectedAssignee = role === "member"
      ? (assignedToMe && currentUserId ? currentUserId : null)
      : (assigneeUserId.trim() || null);

    setMessage(null);
    startTransition(async () => {
      const result = await updateFindingRemediationAction(
        findingId,
        selectedAssignee,
        note.trim() || null,
      );
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setNote(result.data.remediation_note ?? "");
      setAssigneeUserId(result.data.assignee_user_id ?? "");
      setAssignedToMe(Boolean(currentUserId && result.data.assignee_user_id === currentUserId));
      setMessage("Remediation work updated.");
    });
  }

  return (
    <article className="panel findingRemediationPanel">
      <div className="panelTitle"><div><span>Operator workflow</span><h2>Remediation work</h2></div></div>
      <div className="verificationPanel">
        {role === "member" ? (
          currentUserId ? (
            <label className="findingNoteField">
              <span>Assignment</span>
              <span>
                <input
                  checked={assignedToMe}
                  onChange={(event) => setAssignedToMe(event.target.checked)}
                  type="checkbox"
                />{" "}Assign to me
              </span>
            </label>
          ) : null
        ) : (
          <label className="findingNoteField">
            <span>Assignee</span>
            <select
              aria-label="Assignee"
              onChange={(event) => setAssigneeUserId(event.target.value)}
              value={assigneeUserId}
            >
              <option value="">Unassigned</option>
              {assignees.map((assignee) => (
                <option key={assignee.userId} value={assignee.userId}>
                  {assignee.label}{assignee.detail ? ` (${assignee.detail})` : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="findingNoteField">
          <span>Remediation note</span>
          <textarea
            aria-label="Remediation note"
            maxLength={2000}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Describe the current remediation work"
            value={note}
          />
          <small>Maximum 2000 characters.</small>
        </label>

        <div className="heroActions">
          <button className="primaryButton compact" disabled={isPending} onClick={save} type="button">
            Save remediation
          </button>
        </div>
        {message ? <div className="authMessage" role="status">{message}</div> : null}
      </div>
    </article>
  );
}
