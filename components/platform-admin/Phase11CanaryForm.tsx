"use client";

import { useActionState } from "react";
import { launchPhase11CanaryAction, type Phase11CanaryActionResult } from "@/app/admin/phase11/actions";
import type { Phase11CanaryAsset } from "@/lib/platform-admin/phase11-operations";

export default function Phase11CanaryForm({ assets }: { assets: readonly Phase11CanaryAsset[] }) {
  const [state, action, pending] = useActionState<Phase11CanaryActionResult | null, FormData>(
    launchPhase11CanaryAction,
    null,
  );

  return (
    <form className="adminForm" action={action}>
      <label>
        Verified target
        <select name="assetId" required disabled={pending || assets.length === 0}>
          <option value="">Select a verified HTTPS web or API asset</option>
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.name} · {asset.canonicalTarget}
            </option>
          ))}
        </select>
      </label>
      <p className="adminMuted">
        This queues one safe-active root GET through the planner, policy, authorization, and worker queue.
        The hard limits are one request and five seconds.
      </p>
      <button className="adminButton adminButtonPrimary" disabled={pending || assets.length === 0} type="submit">
        {pending ? "Queuing canary..." : "Run bounded canary"}
      </button>
      {assets.length === 0 ? (
        <p className="adminActionMessage adminActionMessageError">No eligible verified HTTPS web or API asset is available in a workspace you own or administer.</p>
      ) : null}
      {state?.ok ? (
        <div className="adminActionMessage">
          <strong>{state.message}</strong>
          <div className="adminCode">Run {state.runId}</div>
          <div className="adminCode">Action {state.actionId}</div>
        </div>
      ) : null}
      {state && !state.ok ? (
        <p className="adminActionMessage adminActionMessageError">{state.error.message}</p>
      ) : null}
    </form>
  );
}
