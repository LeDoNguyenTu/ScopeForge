"use client";

import { useEffect, useMemo, useState } from "react";

function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  const parts = [
    days ? `${days}d` : null,
    days || hours ? `${hours}h` : null,
    `${minutes}m`,
    `${remainder}s`,
  ].filter(Boolean);
  return parts.join(" ");
}

export default function MaintenanceWindowStatus({
  endsAt,
  timeZone,
  autoDisable,
  serverNow,
}: {
  endsAt: string;
  timeZone: string | null;
  autoDisable: boolean;
  serverNow: number;
}) {
  const [now, setNow] = useState(serverNow);
  const end = useMemo(() => Date.parse(endsAt), [endsAt]);

  useEffect(() => {
    const clientStartedAt = Date.now();
    const timer = window.setInterval(() => {
      setNow(serverNow + (Date.now() - clientStartedAt));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [serverNow]);

  useEffect(() => {
    if (autoDisable && now >= end) window.location.reload();
  }, [autoDisable, end, now]);

  const completion = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timeZone ?? undefined,
    timeZoneName: "short",
  }).format(new Date(end));
  const remaining = end - now;

  return (
    <div className="maintenanceWindow" aria-live="polite">
      <span>Estimated completion</span>
      <strong>{completion}</strong>
      <p>
        {remaining > 0
          ? `${formatRemaining(remaining)} remaining`
          : autoDisable
            ? "Restoring service now…"
            : "Estimate reached. An administrator will restore service when the work is complete."}
      </p>
    </div>
  );
}
