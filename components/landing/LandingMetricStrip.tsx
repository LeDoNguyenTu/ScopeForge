import { Boxes, Bug, GitBranch, ShieldCheck } from "lucide-react";

const metrics = [
  { label: "Verified scope", value: "7 assets", note: "Example authorized inventory", Icon: Boxes },
  { label: "Findings", value: "3 open", note: "Example evidence ledger", Icon: Bug },
  { label: "Risk paths", value: "2 linked", note: "Example relationship view", Icon: GitBranch },
  { label: "Authorization", value: "Verified", note: "Example control state", Icon: ShieldCheck },
] as const;

export default function LandingMetricStrip() {
  return (
    <section className="forgeMetricWrap" aria-label="Illustrative ScopeForge platform metrics">
      <div className="forgeMetricLabel">Illustrative platform view</div>
      <div className="forgeMetricStrip">
        {metrics.map(({ label, value, note, Icon }) => (
          <article className="forgeMetric" key={label}>
            <div className="forgeMetricIcon"><Icon size={16} /></div>
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{note}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
