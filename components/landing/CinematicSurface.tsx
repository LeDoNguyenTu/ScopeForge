// The image, connectors and labels share one coordinate system at every size.
const frame = { x: 750, width: 1730, height: 1350 };
const branches = [
  { name: "Web application", status: "2 findings · example", x: 820, y: 1120, anchor: [1190, 1000], path: "1190,1000 1100,1090 820,1090", risk: true },
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
          <image href="/command-center-cinematic.webp" width="2400" height="1350" />
          {branches.map((branch) => (
            <g key={branch.name} className={branch.risk ? "cinematicConnector cinematicConnectorRisk" : "cinematicConnector"}>
              <polyline points={branch.path} />
              <circle cx={branch.anchor[0]} cy={branch.anchor[1]} r="5" />
            </g>
          ))}
        </svg>
        {branches.map((branch) => (
          <span key={branch.name} className={`cinematicSceneLabel${branch.risk ? " cinematicSceneLabelRisk" : ""}`} style={{ left: `${(branch.x - frame.x) / frame.width * 100}%`, top: `${branch.y / frame.height * 100}%`, ...(branch.x === 2400 ? { transform: "translateX(-100%)", textAlign: "right" as const } : {}) }}>
            <strong>{branch.name}</strong><small>{branch.status}</small>
          </span>
        ))}
      </div>
    </div>
  );
}
