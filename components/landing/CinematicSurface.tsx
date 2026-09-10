import { buildSampleSurface, type SampleSurface } from "@/lib/landing/sample-surface";

// Preserve the approved artwork and its shared coordinate system.
const frame = { x: 750, width: 1730, height: 1500 };
const branches = [
  { name: "Web application", status: "2 findings · example", x: 785, y: 1370, anchor: [1190, 1000], path: "1190,1000 1130,1325 785,1325", risk: true },
  { name: "API services", status: "Monitored", x: 785, y: 620, anchor: [980, 545], path: "980,545 895,595 785,595", risk: false },
  { name: "Cloud infrastructure", status: "In scope", x: 785, y: 110, anchor: [1270, 240], path: "1270,240 1160,210 785,210", risk: false },
  { name: "Sandbox", status: "Isolated", x: 1510, y: 20, anchor: [1790, 155], path: "1790,155 1730,100 1510,100", risk: false },
  { name: "Third party", status: "Monitored", x: 2400, y: 160, anchor: [2120, 345], path: "2120,345 2220,315 2400,315", risk: false },
  { name: "Data store", status: "At risk · example", x: 2400, y: 825, anchor: [2200, 700], path: "2200,700 2300,780 2400,780", risk: true },
  { name: "Identity", status: "Healthy", x: 1780, y: 1195, anchor: [2040, 1000], path: "2040,1000 1940,1165 1780,1165", risk: false },
] as const;

const assetIds = ["web", "api", "cloud", "sandbox", "partner", "store", "identity"];

export default function CinematicSurface({ model = buildSampleSurface() }: { model?: SampleSurface }) {
  const sceneBranches = branches.map((branch, index) => {
    const asset = model.nodes.find(node => node.id === assetIds[index])!;
    return { ...branch, assetId: asset.id, risk: asset.findings.length > 0, status: asset.findings.length ? `${asset.findings.length} finding${asset.findings.length === 1 ? "" : "s"} · example` : !asset.verified ? "Needs proof" : asset.onPath ? "On example path" : "Verified" };
  });
  return (
    <div className={`cinematicSurface${model.findings.length === 0 ? " cinematicSurfaceRemediated" : ""}`} role="img" aria-label={`Sample attack surface: ${model.metrics.assets} assets, ${model.metrics.findings} open findings, ${model.metrics.affected} affected assets. Cinematic illustration with labels from the sample records.`}>
      <div className="cinematicArtboard">
        <svg viewBox={`${frame.x} 0 ${frame.width} ${frame.height}`} aria-hidden="true">
          <defs>
            <linearGradient id="scene-fade-x" gradientUnits="userSpaceOnUse" x1="750" x2="2400" y1="0" y2="0">
              <stop offset="0" stopColor="white" stopOpacity="0" /><stop offset=".05" stopColor="white" /><stop offset=".95" stopColor="white" /><stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="scene-fade-y" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="0" y2="1350">
              <stop offset="0" stopColor="white" stopOpacity="0" /><stop offset=".035" stopColor="white" /><stop offset=".965" stopColor="white" /><stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <mask id="scene-mask-x" maskUnits="userSpaceOnUse" x="750" y="0" width="1650" height="1350"><rect x="750" width="1650" height="1350" fill="url(#scene-fade-x)" /></mask>
            <mask id="scene-mask-y" maskUnits="userSpaceOnUse" x="750" y="0" width="1650" height="1350"><rect x="750" width="1650" height="1350" fill="url(#scene-fade-y)" /></mask>
          </defs>
          <g mask="url(#scene-mask-y)"><image href="/command-center-cinematic.webp" width="2400" height="1350" mask="url(#scene-mask-x)" /></g>
          {sceneBranches.map((branch) => (
            <g key={branch.name} data-asset-node={branch.assetId} className={branch.risk ? "cinematicConnector cinematicConnectorRisk" : "cinematicConnector"}>
              <polyline points={branch.path} />
              <circle cx={branch.anchor[0]} cy={branch.anchor[1]} r="5" />
            </g>
          ))}
        </svg>
        {sceneBranches.map((branch, index) => (
          <span key={branch.name} className={`cinematicSceneLabel cinematicSceneLabelSlot-${index}${branch.risk ? " cinematicSceneLabelRisk" : ""}${branch.name === "Cloud infrastructure" ? " cinematicSceneLabelCloud" : ""}`}>
            <strong>{branch.name}</strong><small>{branch.status}</small>
          </span>
        ))}
      </div>
    </div>
  );
}
