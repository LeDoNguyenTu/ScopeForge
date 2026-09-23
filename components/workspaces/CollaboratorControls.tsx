"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { manageCollaborator } from "@/app/dashboard/workspace/actions";
import { useToast } from "@/components/feedback/ToastProvider";
import type { WorkspaceRole } from "@/lib/database.types";

export type Collaborator = { user_id: string; display_name: string | null; email: string; role: WorkspaceRole };

export default function CollaboratorControls({ workspaceId, members }: { workspaceId: string; members: Collaborator[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [roles, setRoles] = useState<Record<string, WorkspaceRole>>(() =>
    Object.fromEntries(members.map((member) => [member.user_id, member.role]))
  );
  useEffect(() => {
    setRoles(Object.fromEntries(members.map((member) => [member.user_id, member.role])));
  }, [members]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    if (values.get("operation") === "remove" && !window.confirm("Remove this collaborator's access to this workspace?")) return;
    setBusy(true);
    try {
      const result = await manageCollaborator(values);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (result.operation === "role" && result.collaboratorId && result.role) {
        setRoles((current) => ({ ...current, [result.collaboratorId!]: result.role! }));
      }
      if (result.operation === "add") form.reset();
      toast.success(result.message);
      router.refresh();
    } catch { toast.error("The change could not be saved. Please try again."); }
    finally { setBusy(false); }
  }
  return <>
    <section className="workspaceSettingsCard">
      <h2>Add a collaborator</h2>
      <p>Enter the email of an existing, confirmed ScopeForge account. Access starts immediately; no invitation email is sent.</p>
      <form className="workspaceMemberForm" onSubmit={submit}>
        <input type="hidden" name="workspaceId" value={workspaceId} /><input type="hidden" name="operation" value="add" />
        <label>Email<input type="email" name="email" required maxLength={254} autoComplete="off" /></label>
        <label>Role<select name="role" defaultValue="member"><option value="member">Member — manage assets and scans</option><option value="viewer">Viewer — read only</option></select></label>
        <button type="submit" className="primaryButton" disabled={busy}>Add collaborator</button>
      </form>
      <p>Only owners and admins can manage collaborators or connect GitHub.</p>
    </section>
    <section className="workspaceSettingsCard">
      <h2>Collaborators</h2>
      <ul className="workspaceMemberList">{members.map(member => <li key={member.user_id}>
        <div><strong>{member.display_name || member.email}</strong><span>{member.email}</span><small>{member.role}</small></div>
        {member.role === "owner" || member.role === "admin" ? <span>Protected role</span> : <div className="workspaceMemberActions">
          <form onSubmit={submit}>
            <input type="hidden" name="workspaceId" value={workspaceId} /><input type="hidden" name="collaboratorId" value={member.user_id} /><input type="hidden" name="operation" value="role" />
            <label className="srOnly" htmlFor={`role-${member.user_id}`}>Role for {member.email}</label>
            <select
              id={`role-${member.user_id}`}
              name="role"
              value={roles[member.user_id] ?? member.role}
              onChange={(event) => setRoles((current) => ({
                ...current,
                [member.user_id]: event.target.value as WorkspaceRole,
              }))}
            ><option value="member">Member</option><option value="viewer">Viewer</option></select>
            <button className="secondaryButton" disabled={busy} type="submit">Save role</button>
          </form>
          <form onSubmit={submit}>
            <input type="hidden" name="workspaceId" value={workspaceId} /><input type="hidden" name="collaboratorId" value={member.user_id} /><input type="hidden" name="operation" value="remove" />
            <button className="secondaryButton" disabled={busy} type="submit" aria-label={`Remove ${member.email}`}>Remove</button>
          </form>
        </div>}
      </li>)}</ul>
    </section>
  </>;
}
