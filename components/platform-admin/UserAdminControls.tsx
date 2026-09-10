"use client";

import { useActionState } from "react";
import {
  deleteUserAction,
  restoreUserAction,
  suspendUserAction,
  type PlatformAdminActionResult,
} from "@/app/admin/users/actions";
import type { PlatformUserStatus } from "@/lib/platform-admin/users";
import type { PlatformAdminRole } from "@/lib/platform-admin/types";

function ActionMessage({ state }: { state: PlatformAdminActionResult | null }) {
  if (!state) return null;
  return state.ok
    ? <p className="adminActionMessage">{state.message}</p>
    : <p className="adminActionMessage adminActionMessageError">{state.error.message}</p>;
}

export default function UserAdminControls({
  userId,
  email,
  status,
  platformRole,
  isCurrentUser,
}: {
  userId: string;
  email: string | null;
  status: PlatformUserStatus;
  platformRole: PlatformAdminRole | null;
  isCurrentUser: boolean;
}) {
  const [suspendState, suspendAction, suspendPending] = useActionState(suspendUserAction, null);
  const [restoreState, restoreAction, restorePending] = useActionState(restoreUserAction, null);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteUserAction, null);
  const protectedTarget = isCurrentUser || platformRole !== null;

  if (protectedTarget) {
    return (
      <div className="adminActionCard">
        <h3>Protected administrator account</h3>
        <p>{isCurrentUser ? "You cannot suspend or delete the account currently administering ScopeForge." : "Platform administrator accounts cannot be changed through routine user moderation."}</p>
      </div>
    );
  }

  return (
    <div className="adminActionStack">
      {status === "suspended" ? (
        <section className="adminActionCard">
          <h3>Restore user</h3>
          <p>Clears the Supabase Auth ban and allows future authentication again.</p>
          <form className="adminForm" action={restoreAction}>
            <input type="hidden" name="userId" value={userId} />
            <label>Reason<input required maxLength={500} name="reason" placeholder="Why is access being restored?" /></label>
            <button className="adminButton adminButtonPrimary" disabled={restorePending} type="submit">{restorePending ? "Restoring..." : "Restore access"}</button>
          </form>
          <ActionMessage state={restoreState} />
        </section>
      ) : (
        <section className="adminActionCard">
          <h3>Suspend user</h3>
          <p>Blocks future authentication. An access token already issued before suspension may remain valid until its JWT expiry.</p>
          <form className="adminForm" action={suspendAction}>
            <input type="hidden" name="userId" value={userId} />
            <label>Reason<input required maxLength={500} name="reason" placeholder="Why is this account being suspended?" /></label>
            <button className="adminButton" disabled={suspendPending} type="submit">{suspendPending ? "Suspending..." : "Suspend user"}</button>
          </form>
          <ActionMessage state={suspendState} />
        </section>
      )}

      <section className="adminActionCard">
        <h3>Hard-delete user</h3>
        <p>Permanent. ScopeForge refuses deletion unless every workspace created by this user is exclusively held by this same account. Eligible personal workspaces are deleted before the Auth account.</p>
        <form className="adminForm" action={deleteAction}>
          <input type="hidden" name="userId" value={userId} />
          <label>Reason<textarea required maxLength={500} name="reason" placeholder="Why is permanent deletion required?" /></label>
          <label>Type current email exactly<input required maxLength={320} name="emailConfirmation" autoComplete="off" placeholder={email ?? "User has no deletable email identity"} disabled={!email} /></label>
          <button className="adminButton adminButtonDanger" disabled={deletePending || !email} type="submit">{deletePending ? "Deleting..." : "Delete user permanently"}</button>
        </form>
        <ActionMessage state={deleteState} />
      </section>
    </div>
  );
}
