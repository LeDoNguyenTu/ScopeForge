import { buildSampleSurface, type SampleSurface } from "@/lib/landing/sample-surface";

function diamond(x: number, y: number, width: number, height: number) {
  return `${x},${y - height} ${x + width},${y} ${x},${y + height} ${x - width},${y}`;
}

export default function CinematicSurface({ model = buildSampleSurface() }: { model?: SampleSurface }) {
  const center = { x: 390, y: 335 };
  const pathNodes = model.path.map(id => model.nodes.find(node => node.id === id)!);
  return <div className="dataSurface" role="img" aria-label={`Sample attack surface: ${model.metrics.assets} assets, ${model.metrics.findings} open findings, ${model.metrics.affected} affected assets. Orange connections show a potential exposure path; dotted connections show workspace membership.`}>
    <svg viewBox="0 0 800 710" aria-hidden="true">
      <defs>
        <linearGradient id="pod-metal" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#385456"/><stop offset=".45" stopColor="#142a30"/><stop offset="1" stopColor="#081218"/></linearGradient>
        <radialGradient id="core-light"><stop stopColor="#57dec6" stopOpacity=".22"/><stop offset="1" stopColor="#57dec6" stopOpacity="0"/></radialGradient>
        <filter id="topology-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3"/></filter>
      </defs>
      <ellipse cx={center.x} cy={center.y} rx="340" ry="270" fill="url(#core-light)"/>
      {[105, 150, 205].map(radius => <ellipse key={radius} cx={center.x} cy={center.y} rx={radius} ry={radius * .57} fill="none" stroke="#58dfc6" strokeOpacity=".13" strokeDasharray="3 12"/>)}
      {model.nodes.map(node => <g key={node.id} data-scope-link={node.id}>
        <path d={`M ${center.x} ${center.y} L ${node.x} ${node.y}`} stroke="#0c1c22" strokeWidth="26"/>
        <path d={`M ${center.x} ${center.y} L ${node.x} ${node.y}`} stroke="#345458" strokeWidth="1.5" strokeDasharray="4 9"/>
      </g>)}
      {pathNodes.slice(1).map((node, index) => {
        const from = pathNodes[index];
        const d = `M ${from.x} ${from.y} Q ${(from.x + node.x) / 2} ${(from.y + node.y) / 2 - 55} ${node.x} ${node.y}`;
        return <g key={`${from.id}-${node.id}`} data-exposure-edge={`${from.id}-${node.id}`}><path d={d} fill="none" stroke="#ff9b5e" strokeWidth="8" opacity=".28" filter="url(#topology-glow)"/><path d={d} fill="none" stroke="#ffab70" strokeWidth="2.5"/></g>;
      })}
      <g><ellipse cx={center.x} cy={center.y + 17} rx="103" ry="60" fill="#060d12" stroke="#294d50"/><ellipse cx={center.x} cy={center.y} rx="103" ry="60" fill="url(#pod-metal)" stroke="#62d4c0" strokeWidth="2"/>
        <ellipse cx={center.x} cy={center.y} rx="85" ry="48" fill="none" stroke="#5ce3c7" strokeOpacity=".5"/>
        <path d="M390 297 L418 311 L414 341 L390 360 L366 341 L362 311 Z" fill="#102f32" stroke="#87efd8" strokeWidth="2"/>
        <path d="M380 329 L388 337 L403 317" fill="none" stroke="#a6f7e2" strokeWidth="3"/>
        <text x="390" y="418" textAnchor="middle" className="dataSurfaceCenter">WORKSPACE</text>
      </g>
      {model.nodes.map(node => {
        const color = node.onPath ? "#ffa46a" : node.verified ? "#6de5ca" : "#e9c17c";
        return <g key={node.id} data-asset-node={node.id} style={{ color }}>
          <ellipse cx={node.x} cy={node.y + 24} rx="70" ry="33" fill="currentColor" opacity=".07" filter="url(#topology-glow)"/>
          <polygon points={diamond(node.x, node.y + 13, 60, 29)} fill="#09161c" stroke="#29454b"/>
          <polygon points={diamond(node.x, node.y, 60, 29)} fill="url(#pod-metal)" stroke="currentColor" strokeOpacity=".6"/>
          <polygon points={diamond(node.x, node.y - 2, 46, 21)} fill="none" stroke="currentColor" strokeOpacity=".25"/>
          <path d={`M ${node.x - 23} ${node.y - 16} v -42 l 23 -12 l 23 12 v 42 l -23 13 Z M ${node.x - 23} ${node.y - 58} l 23 12 l 23 -12 M ${node.x} ${node.y - 46} v 43`} fill="currentColor" fillOpacity=".07" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx={node.x} cy={node.y} r="4" fill="currentColor"/>
          {node.findings.length > 0 && <g><circle cx={node.x + 39} cy={node.y - 40} r="15" fill="#482b20" stroke="currentColor"/><text x={node.x + 39} y={node.y - 34} textAnchor="middle" fill="#ffd4b8" fontSize="17" fontWeight="700">{node.findings.length}</text></g>}
          <path d={`M ${node.x} ${node.y + 29} v 18`} stroke="currentColor" opacity=".65"/>
        </g>;
      })}
    </svg>
    {model.nodes.map(node => <span key={node.id} className={`dataNodeLabel ${node.onPath ? "dataNodeRisk" : !node.verified ? "dataNodePending" : ""}`} style={{ left: `${node.x / 8}%`, top: `${(node.y + 51) / 7.1}%` }}>
      <strong>{node.name}</strong><small>{node.findings.length ? `${node.findings.length} open finding${node.findings.length === 1 ? "" : "s"}` : node.onPath ? "On example path" : node.verified ? "Ownership verified" : "Needs ownership proof"}</small>
    </span>)}
  </div>;
}
