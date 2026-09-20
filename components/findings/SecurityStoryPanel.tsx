import type { SecurityStoryV1 } from "@/lib/security-remediation/types";

export interface SecurityStoryPanelProps {
  assigneeLabel?: string | null;
  story: SecurityStoryV1;
}

export default function SecurityStoryPanel({ assigneeLabel, story }: SecurityStoryPanelProps) {
  return (
    <section className="panel assetPanel findingStoryPanel">
      <div className="panelTitle"><div><span>Finding guidance</span><h2>What this means and what to do next</h2></div></div>
      <p className="findingStorySummary">{story.summary}</p>

      <div className="findingStoryGrid">
        <div><span>What happened</span><strong>{story.impact}</strong></div>
        <div><span>Recommended fix</span><strong>{story.remediation.guidance}</strong></div>
        <div><span>How to verify</span><strong>{story.verification.summary}</strong></div>
        {story.remediation.note ? <div><span>Current work</span><strong>{story.remediation.note}</strong></div> : null}
      </div>

      <div className="findingStoryMeta">
        <span>{story.remediation.provenanceLabel}</span>
        <span>{story.verification.provenanceLabel}</span>
        {story.remediation.assigneeUserId ? <span>Assigned to {assigneeLabel ?? "a workspace member"}</span> : null}
      </div>

      <div className="panelTitle"><div><span>Bounded evidence</span><h3>Evidence used by this story</h3></div></div>
      {story.evidence.length > 0 ? (
        <div className="auditList">
          {story.evidence.map((item) => (
            <div className="auditRow" key={item.evidenceId}>
              <div>
                <strong>{item.kind.replaceAll("_", " ")}</strong>
                <p>{item.summary}</p>
              </div>
              <span className="modulePhase">{item.provenanceLabel}</span>
            </div>
          ))}
        </div>
      ) : <p className="authMessage">No linked evidence was available for this deterministic story.</p>}
    </section>
  );
}
