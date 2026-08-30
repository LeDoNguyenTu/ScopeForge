"use client";

import { useEffect, useState } from "react";
import ScopeForgeMark from "@/components/brand/ScopeForgeMark";

function getGreeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function ScopeForgeBootScreen({ progress, stage }: { progress: number; stage: string }) {
  const boundedProgress = Math.max(0, Math.min(100, Math.round(progress)));
  const [greeting, setGreeting] = useState("Welcome to ScopeForge");

  useEffect(() => {
    setGreeting(`${getGreeting(new Date().getHours())} - welcome to ScopeForge`);
  }, []);

  return (
    <div className="scopeForgeBoot" role="status" aria-live="polite" aria-label="ScopeForge initialization">
      <div className="scopeForgeBootBackdrop" aria-hidden="true" />
      <div className="scopeForgeBootCard">
        <div className="scopeForgeBootMark" aria-hidden="true">
          <span className="scopeForgeBootOrbit" />
          <ScopeForgeMark size={58} decorative />
        </div>
        <p className="scopeForgeBootGreeting">{greeting}</p>
        <h1>Preparing living attack surface</h1>
        <div className="scopeForgeBootProgressRow">
          <output>{boundedProgress}%</output>
          <span>{stage}</span>
        </div>
        <div
          className="scopeForgeBootTrack"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={boundedProgress}
          aria-label="Attack surface initialization progress"
        >
          <span style={{ width: `${boundedProgress}%` }} />
        </div>
        <p className="scopeForgeBootNote">Preparing authorized security workspace visuals</p>
      </div>
    </div>
  );
}
