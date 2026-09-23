"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
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
  const [timeZone, setTimeZone] = useState(settings.maintenanceTimeZone ?? "");
  const timeZones = useMemo(() => (
    typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []
  ), []);

  useEffect(() => {
    if (!settings.maintenanceTimeZone) {
      setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    }
  }, [settings.maintenanceTimeZone]);

  const completionDefault = settings.maintenanceEndsAt
    ? new Intl.DateTimeFormat("sv-SE", {
      timeZone: settings.maintenanceTimeZone ?? undefined,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(settings.maintenanceEndsAt)).replace(" ", "T")
    : "";

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

      <fieldset className="adminSettingsGroup adminMaintenanceWindow">
        <legend>Maintenance window</legend>
        <p className="adminFieldHint">One absolute completion time keeps the countdown synchronized worldwide. The selected zone changes how that instant is entered and displayed.</p>
        <div className="adminMaintenanceFields">
          <label>
            Estimated completion
            <input type="datetime-local" name="maintenanceEndsAt" defaultValue={completionDefault} />
          </label>
          <label>
            Master time zone
            <input
              list="scopeforge-time-zones"
              name="maintenanceTimeZone"
              value={timeZone}
              onChange={(event) => setTimeZone(event.target.value)}
              placeholder="Browser time zone"
            />
            <datalist id="scopeforge-time-zones">
              {timeZones.map((zone) => <option key={zone} value={zone} />)}
            </datalist>
          </label>
        </div>
        <label className="adminCheckbox adminSettingsToggle adminMaintenanceAutoDisable">
          <input type="checkbox" name="maintenanceAutoDisable" defaultChecked={settings.maintenanceAutoDisable} />
          <span>Automatically restore service when the countdown ends</span>
        </label>
        <p className="adminFieldHint">Turn this off when an administrator must manually disable maintenance after the estimate.</p>
      </fieldset>

      <div className="adminSettingsSubmit">
        <button className="adminButton adminButtonPrimary" disabled={pending} type="submit">{pending ? "Saving..." : "Save platform settings"}</button>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}
