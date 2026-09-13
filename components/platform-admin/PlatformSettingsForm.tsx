"use client";

import { useActionState } from "react";
import { updatePlatformSettingsAction } from "@/app/admin/settings/actions";
import type { PlatformAdminActionResult } from "@/app/admin/users/actions";
import type { PlatformSettings } from "@/lib/platform-admin/types";

function ActionMessage({ state }: { state: PlatformAdminActionResult | null }) {
  if (!state) return null;
  return state.ok
    ? <p className="adminActionMessage">{state.message}</p>
    : <p className="adminActionMessage adminActionMessageError">{state.error.message}</p>;
}

export default function PlatformSettingsForm({ settings }: { settings: PlatformSettings }) {
  const [state, action, pending] = useActionState(updatePlatformSettingsAction, null);

  return (
    <form className="adminForm adminSettingsForm" action={action}>
      <div className="adminSettingsGroup">
        <div className="adminSettingsToggleRow">
          <div>
            <strong>Account registration</strong>
            <p>When disabled, the sign-up page closes and the database onboarding trigger rejects direct Auth sign-ups as the authoritative boundary.</p>
          </div>
          <label className="adminCheckbox adminSettingsToggle">
            <input type="checkbox" name="registrationEnabled" defaultChecked={settings.registrationEnabled} />
            <span>Allow new accounts</span>
          </label>
        </div>

        <div className="adminSettingsToggleRow">
          <div>
            <strong>Maintenance mode</strong>
            <p>Ordinary public and dashboard pages are redirected to maintenance. Admin, authentication, API, and internal worker routes remain reachable.</p>
          </div>
          <label className="adminCheckbox adminSettingsToggle">
            <input type="checkbox" name="maintenanceMode" defaultChecked={settings.maintenanceMode} />
            <span>Enable maintenance</span>
          </label>
        </div>
      </div>

      <div className="adminSettingsGroup adminSettingsTextGroup">
        <label>
          Maintenance message
          <textarea name="maintenanceMessage" required minLength={1} maxLength={280} defaultValue={settings.maintenanceMessage} />
        </label>

        <label>
          Change reason
          <textarea name="reason" required minLength={1} maxLength={500} placeholder="Why are these platform settings changing?" />
        </label>
      </div>

      <div className="adminSettingsSubmit">
        <button className="adminButton adminButtonPrimary" disabled={pending} type="submit">{pending ? "Saving..." : "Save platform settings"}</button>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}
