"use client";

import { useId, useMemo } from "react";
import ScopeForgeMark from "@/components/brand/ScopeForgeMark";
import type { AttackSurfaceModel, AttackSurfaceNode } from "@/lib/dashboard/attack-surface-model";

function polarPosition(node: AttackSurfaceNode): [number, number] {
  const radians = (node.angle * Math.PI) / 180;
  return [Math.cos(radians) * node.radius * 0.88, Math.sin(radians) * node.radius * 0.72];
}

function toneFor(node: AttackSurfaceNode) {
  if (node.state === "risk") return "#ff9967";
  if (node.state === "pending") return "#e5ba71";
  return "#56dcc5";
}

function nodeStatus(node: AttackSurfaceNode) {
  if (node.state === "risk") {
    return `${node.findingCount} active finding${node.findingCount === 1 ? "" : "s"}`;
  }
  if (node.state === "pending") return "Verification pending";
  return "Verified scope";
}

function shorten(value: string, max = 24) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

export default function CspSafeAttackSurface({ model }: { model: AttackSurfaceModel }) {
  const sceneId = useId().replaceAll(":", "");
  const visualNodes = useMemo(() => model.nodes.map((node, index) => ({
    ...node,
    angle: -150 + index * (360 / Math.max(1, model.nodes.length)),
  })), [model.nodes]);

  return (
    <div
      className="webglAttackSurface"
      data-testid="webgl-attack-surface"
      data-renderer-state="svg"
      aria-label="Workspace attack surface topology"
    >
      <svg className="workspaceTopologyArt" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`${sceneId}-metal`} x1="0" y1="0" x2="0.8" y2="1">
            <stop stopColor="#304c54" />
            <stop offset=".5" stopColor="#101e28" />
            <stop offset="1" stopColor="#1f3941" />
          </linearGradient>
          <radialGradient id={`${sceneId}-glow`}>
            <stop stopColor="#51e8cd" stopOpacity=".2" />
            <stop offset="1" stopColor="#51e8cd" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse cx="500" cy="325" rx="300" ry="200" fill={`url(#${sceneId}-glow)`} />
        <ellipse className="cspTopologyOrbit cspTopologyOrbitOuter" cx="500" cy="306" rx="340" ry="210" />
        <ellipse className="cspTopologyOrbit cspTopologyOrbitMiddle" cx="500" cy="306" rx="250" ry="154" />
        <ellipse className="cspTopologyOrbit cspTopologyOrbitInner" cx="500" cy="306" rx="165" ry="101" />

        {visualNodes.map((node) => {
          const [px, py] = polarPosition(node);
          const x = 500 + px * 470;
          const y = 300 - py * 312;
          const tone = toneFor(node);
          return (
            <g key={node.id}>
              <path d={`M500 318 L${x} ${y + 18}`} stroke="#04090d" strokeWidth="42" />
              <path d={`M500 307 L${x} ${y + 7}`} stroke="#294650" strokeWidth="34" />
              <path d={`M500 305 L${x} ${y + 5}`} stroke="#15252e" strokeWidth="28" />
              <path d={`M500 305 L${x} ${y + 5}`} stroke={tone} strokeWidth="2" opacity=".72" />
              <path d={`M500 305 L${x} ${y + 5}`} stroke="#89a4ae" strokeWidth="26" strokeDasharray="1 18" opacity=".35" />
              <ellipse cx={x} cy={y + 14} rx="53" ry="28" fill="#050b10" stroke="#35515a" />
              <ellipse cx={x} cy={y + 6} rx="53" ry="28" fill={`url(#${sceneId}-metal)`} stroke={tone} strokeOpacity=".55" />
              <ellipse cx={x} cy={y + 4} rx="39" ry="20" fill="#0b1b24" stroke={tone} strokeOpacity=".4" />
              <path
                d={`M${x - 18} ${y - 37} l18 -12 l18 12 v34 l-18 12 l-18 -12 Z M${x - 18} ${y - 37} l18 12 l18 -12 M${x} ${y - 25} v34 M${x} ${y - 49} v34 l-18 12 M${x} ${y - 15} l18 12`}
                fill={tone}
                fillOpacity=".08"
                stroke={tone}
                strokeWidth="1.4"
              />
              <circle cx={x} cy={y - 25} r="3" fill={tone} />
            </g>
          );
        })}

        {visualNodes.length > 0 ? (
          <g>
            <ellipse cx="500" cy="328" rx="136" ry="82" fill="#061017" stroke="#294c56" strokeWidth="3" />
            <ellipse cx="500" cy="312" rx="136" ry="82" fill={`url(#${sceneId}-metal)`} stroke="#4ebfaa" strokeOpacity=".65" strokeWidth="2" />
            <ellipse cx="500" cy="312" rx="122" ry="70" fill="none" stroke="#579a99" strokeWidth="6" strokeDasharray="2 17" opacity=".5" />
            <ellipse cx="500" cy="307" rx="105" ry="60" fill="#0a252a" stroke="#5be6c9" strokeOpacity=".7" strokeWidth="2" />
            <ellipse cx="500" cy="304" rx="84" ry="49" fill="#122b33" stroke="#5be6c9" strokeOpacity=".45" />
          </g>
        ) : null}
      </svg>

      <div className="webglAttackFallback" aria-hidden="true">
        <span className="webglFallbackRing webglFallbackRingOne" />
        <span className="webglFallbackRing webglFallbackRingTwo" />
        <span className="webglFallbackRing webglFallbackRingThree" />
      </div>

      {visualNodes.length > 0 ? (
        <div className="webglAttackCore" aria-hidden="true">
          <span className="webglCoreHalo" />
          <span className="webglCoreOrbit" />
          <ScopeForgeMark size={74} />
        </div>
      ) : null}

      <svg className="workspaceTopologyLabels" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
        {visualNodes.map((node, index) => {
          const [px, py] = polarPosition(node);
          const x = 500 + px * 470;
          const y = 300 - py * 312;
          const labelY = y + 54;
          return (
            <g key={`label-${node.id}`} transform={`translate(${x} ${labelY})`} className={`cspTopologyLabel cspTopologyLabel-${node.state}`}>
              <circle className="cspTopologyNumberDisc" cx="-92" cy="16" r="12" />
              <text className="cspTopologyNumber" x="-92" y="20" textAnchor="middle">{index + 1}</text>
              <rect className="cspTopologyLabelPanel" x="-76" y="-5" width="152" height="58" rx="6" />
              <line className="cspTopologyLabelAccent" x1="-76" y1="-5" x2="-76" y2="53" />
              <text className="cspTopologyKind" x="-64" y="10">{node.kind.replaceAll("_", " ")}</text>
              <text className="cspTopologyName" x="-64" y="29">{shorten(node.label)}</text>
              <text className="cspTopologyStatus" x="-64" y="45">{shorten(nodeStatus(node), 28)}</text>
            </g>
          );
        })}
      </svg>

      {model.nodes.length === 0 ? (
        <div className="webglAttackEmpty">
          <ScopeForgeMark size={58} />
          <strong>No verified attack surface yet</strong>
          <span>Add and verify your first asset to build this workspace map.</span>
        </div>
      ) : null}
    </div>
  );
}
