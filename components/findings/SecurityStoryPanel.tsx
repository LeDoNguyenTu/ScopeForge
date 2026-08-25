import type { SecurityStoryV1 } from "@/lib/security-remediation/types";

export interface SecurityStoryPanelProps {
  story: SecurityStoryV1;
}

export default function SecurityStoryPanel({ story }: SecurityStoryPanelProps) {
  return (
    <section className="panel assetPanel">
      <div className="panelTitle"><div><span>Security Story v1</span><h2>What happened and what to do next</h2></div></div>

      <div className="detailList">
        <div><span>Summary</span><strong>{story.summary}</strong></div>
        <div><span>Impact</span><strong>{story.impact}</strong></div>
        <div><span>Remediation guidance</span><strong>{story.remediation.guidance}</strong></div>
        <div><span>Remediation provenance</span><strong>{story.remediation.provenanceLabel}</strong></div>
        {story.remediation.assigneeUserId ? <div><span>Assignee</span><strong>{story.remediation.assigneeUserId}</strong></div> : null}
        {story.remediation.note ? <div><span>Operator note</span><strong>{story.remediation.note}</strong></div> : null}
        <div><span>Verification</span><strong>{story.verification.summary}</strong></div>
        <div><span>Verification provenance</span><strong>{story.verification.provenanceLabel}</strong></div>
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
