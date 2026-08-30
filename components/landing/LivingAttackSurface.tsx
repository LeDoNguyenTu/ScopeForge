"use client";

import type { PointerEvent } from "react";
import ScopeForgeMark from "@/components/brand/ScopeForgeMark";

const nodes = [
  { id: "web", label: "Web App", x: 18, y: 38, state: "risk" },
  { id: "api", label: "API", x: 31, y: 18, state: "healthy" },
  { id: "repo", label: "Repository", x: 55, y: 12, state: "healthy" },
  { id: "cloud", label: "Cloud", x: 79, y: 24, state: "healthy" },
  { id: "third", label: "Third Party", x: 88, y: 52, state: "observe" },
  { id: "data", label: "Data Store", x: 72, y: 82, state: "risk" },
  { id: "identity", label: "Identity", x: 35, y: 84, state: "healthy" },
] as const;

function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
  const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
  event.currentTarget.style.setProperty("--surface-x", x.toFixed(3));
  event.currentTarget.style.setProperty("--surface-y", y.toFixed(3));
}

function handlePointerLeave(event: PointerEvent<HTMLDivElement>) {
  event.currentTarget.style.setProperty("--surface-x", "0");
  event.currentTarget.style.setProperty("--surface-y", "0");
}

export default function LivingAttackSurface() {
  return (
    <div
      className="attackSurface"
      role="img"
      aria-label="Illustrative attack surface map showing authorized security domains and example risk paths"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div className="attackSurfaceGrid" aria-hidden="true" />
      <svg className="attackSurfaceSvg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="surfaceCoreGlow">
            <stop offset="0" stopColor="#4fe0c1" stopOpacity="0.32" />
            <stop offset="1" stopColor="#4fe0c1" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="31" fill="none" stroke="rgba(85,199,223,.08)" strokeWidth="0.35" strokeDasharray="1 2" />
        <circle cx="50" cy="50" r="21" fill="none" stroke="rgba(79,224,193,.12)" strokeWidth="0.35" />
        <circle cx="50" cy="50" r="15" fill="url(#surfaceCoreGlow)" />
        {nodes.map((node) => (
          <g key={node.id}>
            <line
              className={`surfacePath surfacePath-${node.state}`}
              x1="50"
              y1="50"
              x2={node.x}
              y2={node.y}
            />
            <circle className={`surfaceNodeHalo surfaceNode-${node.state}`} cx={node.x} cy={node.y} r="3.1" />
            <circle className={`surfaceNodeCore surfaceNode-${node.state}`} cx={node.x} cy={node.y} r="1.15" />
          </g>
        ))}
      </svg>

      <div className="surfaceCore" aria-hidden="true">
        <span className="surfaceCoreRing" />
        <ScopeForgeMark size={72} />
      </div>

      {nodes.map((node) => (
        <div
          className={`surfaceLabel surfaceLabel-${node.state}`}
          key={node.id}
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
          aria-hidden="true"
        >
          <span>{node.label}</span>
          <small>{node.state === "risk" ? "Example risk path" : node.state === "observe" ? "Observed boundary" : "Verified scope"}</small>
        </div>
      ))}

      <div className="surfaceLegend" aria-hidden="true">
        <span><i className="surfaceLegendHealthy" /> Verified</span>
        <span><i className="surfaceLegendRisk" /> Example risk</span>
      </div>
      <p className="surfaceDisclaimer">Product illustration - not live workspace telemetry.</p>
    </div>
  );
}
