// The image, connectors and labels share one coordinate system at every size.
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

export default function CinematicSurface() {
  return (
    <div className="cinematicSurface" role="img" aria-label="Illustrative attack surface: web application findings on the foreground orange path, orange data store at risk, monitored APIs, cloud infrastructure in scope, isolated sandbox, monitored third party, and healthy identity. Example data.">
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
          {branches.map((branch) => (
            <g key={branch.name} className={branch.risk ? "cinematicConnector cinematicConnectorRisk" : "cinematicConnector"}>
              <polyline points={branch.path} />
              <circle cx={branch.anchor[0]} cy={branch.anchor[1]} r="5" />
            </g>
          ))}
        </svg>
        {branches.map((branch) => (
          <span key={branch.name} className={`cinematicSceneLabel${branch.risk ? " cinematicSceneLabelRisk" : ""}${branch.name === "Cloud infrastructure" ? " cinematicSceneLabelCloud" : ""}`} style={{ left: `${(branch.x - frame.x) / frame.width * 100}%`, top: `${branch.y / frame.height * 100}%`, ...(branch.x === 2400 ? { transform: "translateX(-100%)", textAlign: "right" as const } : {}) }}>
            <strong>{branch.name}</strong><small>{branch.status}</small>
          </span>
        ))}
      </div>
    </div>
  );
}
