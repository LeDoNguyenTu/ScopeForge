"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";

export const ATTACK_SURFACE_PAUSE_EVENT = "scopeforge:attack-surface-pause";

export default function SceneMonitoringToggle() {
  const [paused, setPaused] = useState(false);

  const toggle = () => {
    const next = !paused;
    setPaused(next);
    window.dispatchEvent(new CustomEvent(ATTACK_SURFACE_PAUSE_EVENT, { detail: { paused: next } }));
  };

  return (
    <button
      type="button"
      aria-pressed={paused}
      aria-label={paused ? "Resume animation" : "Pause animation"}
      title={paused ? "Resume the illustrative attack-surface animation" : "Pause the illustrative attack-surface animation"}
      onClick={toggle}
    >
      {paused ? <Play size={14} /> : <Pause size={14} />}
      {paused ? "Resume animation" : "Pause animation"}
    </button>
  );
}
