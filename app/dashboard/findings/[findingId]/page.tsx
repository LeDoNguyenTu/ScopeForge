import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bug, Clock3, FileClock, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import FindingLifecycleControls from "@/components/findings/FindingLifecycleControls";
import FindingRemediationPanel from "@/components/findings/FindingRemediationPanel";
import FindingRetestPanel from "@/components/findings/FindingRetestPanel";
import SecurityStoryPanel from "@/components/findings/SecurityStoryPanel";
import type { Json } from "@/lib/database.types";
import { createSecurityFindingRepository } from "@/lib/security-findings/repository";
import { resolveRetestSource } from "@/lib/security-remediation/source-registry";
import { buildSecurityStoryV1 } from "@/lib/security-remediation/story";
import { getDashboardContext } from "@/lib/workspaces/current";

export const dynamic = "force-dynamic";

function label(value: string): string {
  return value.replaceAll("_", " ");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Singapore",
  }).format(new Date(value));
}

function scalarEntries(
  value: Json | null,
  prefix = "",
  depth = 0,
): Array<readonly [string, string]> {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 2) return [];
  const rows: Array<readonly [string, string]> = [];

  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined || entry === null) continue;
    const name = prefix ? `${prefix} ${key}` : key;
    if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
      rows.push([label(name), String(entry)] as const);
      continue;
    }
    if (Array.isArray(entry)) {
      const scalars = entry.filter((item) =>
        typeof item === "string" || typeof item === "number" || typeof item === "boolean");
      if (scalars.length > 0) rows.push([label(name), scalars.slice(0, 8).join(", ")] as const);
      continue;
    }
    rows.push(...scalarEntries(entry, name, depth + 1));
  }

  return rows.slice(0, 16);
}

export default async function FindingDetailPage({
  params,
}: {
  params: Promise<{ findingId: string }>;
}) {
  const { findingId } = await params;
  const { supabase, user, workspace, role, displayName } = await getDashboardContext();
  const repository = createSecurityFindingRepository(supabase);
  const detail = await repository.loadWorkspaceFindingDetail(workspace.id, findingId);
  if (!detail) notFound();
  const workflow = await repository.loadWorkspaceFindingWorkflowDetail(workspace.id, findingId);

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id,name,canonical_target")
    .eq("workspace_id", workspace.id)
    .eq("id", detail.finding.asset_id)
    .maybeSingle();
  if (assetError) throw new Error("Unable to load the finding asset.");

  const taxonomy = scalarEntries(detail.finding.taxonomy);
  const remediation = scalarEntries(detail.finding.remediation);
  const retestSource = resolveRetestSource(detail.finding);
  const story = buildSecurityStoryV1({
    finding: detail.finding,
    evidence: detail.evidence,
    occurrences: detail.occurrences,
    events: detail.events,
    work: workflow.work,
    retests: workflow.retests,
  });

  return (
    <AppShell displayName={displayName} workspaceName={workspace.name} role={role}>
      <section className="pageHeader">
        <div>
          <Link className="sectionEyebrow" href="/dashboard/findings"><ArrowLeft size={13} /> Findings</Link>
          <h1>{detail.finding.title}</h1>
          <p>{detail.finding.description}</p>
        </div>
        <div className="healthBadge"><Bug size={16} /> {label(detail.finding.severity)} severity</div>
      </section>

      <section className="grid4 assetSummaryGrid">
        <article className="statCard"><div><span>Lifecycle</span><Clock3 size={18} /></div><strong>{label(detail.finding.lifecycle_state)}</strong><small>Current canonical state</small></article>
        <article className="statCard"><div><span>Validation</span><ShieldCheck size={18} /></div><strong>{label(detail.finding.validation_state)}</strong><small>{label(detail.finding.confidence)} confidence</small></article>
        <article className="statCard"><div><span>Occurrences</span><FileClock size={18} /></div><strong>{detail.occurrences.length}</strong><small>Recorded observations</small></article>
        <article className="statCard"><div><span>Evidence</span><ShieldCheck size={18} /></div><strong>{detail.evidence.length}</strong><small>Linked immutable records</small></article>
      </section>

      <section className="dashboardGrid">
        <article className="panel">
          <div className="panelTitle"><div><span>Finding identity</span><h2>Security context</h2></div></div>
          <div className="detailList">
            <div><span>Asset</span><strong>{asset?.name ?? detail.finding.asset_id}</strong></div>
            {asset?.canonical_target ? <div><span>Authorized target</span><strong>{asset.canonical_target}</strong></div> : null}
            <div><span>Rule</span><strong>{detail.finding.rule_ref}</strong></div>
            <div><span>Source</span><strong>{detail.finding.source_id}</strong></div>
            <div><span>Severity</span><strong>{label(detail.finding.severity)}</strong></div>
            <div><span>Confidence</span><strong>{label(detail.finding.confidence)}</strong></div>
            <div><span>First seen</span><strong>{formatDate(detail.finding.first_seen_at)}</strong></div>
            <div><span>Last seen</span><strong>{formatDate(detail.finding.last_seen_at)}</strong></div>
          </div>
        </article>

        <article className="panel">
          <div className="panelTitle"><div><span>Operator workflow</span><h2>Lifecycle</h2></div></div>
          <FindingLifecycleControls
            findingId={detail.finding.finding_id}
            lifecycleState={detail.finding.lifecycle_state}
            role={role}
          />
        </article>
      </section>

      <section className="dashboardGrid">
        <FindingRemediationPanel
          currentUserId={user.id}
          findingId={detail.finding.finding_id}
          role={role}
          work={workflow.work}
        />
        <FindingRetestPanel
          executionKind={retestSource?.executionKind ?? null}
          findingId={detail.finding.finding_id}
          lifecycleState={detail.finding.lifecycle_state}
          retests={workflow.retests}
          role={role}
        />
      </section>

      <SecurityStoryPanel story={story} />

      <section className="dashboardGrid">
        <article className="panel">
          <div className="panelTitle"><div><span>Classification</span><h2>Taxonomy</h2></div></div>
          {taxonomy.length > 0 ? (
            <div className="detailList">
              {taxonomy.map(([name, value]) => <div key={`${name}-${value}`}><span>{name}</span><strong>{value}</strong></div>)}
            </div>
          ) : <p className="authMessage">No scalar taxonomy fields are available for display.</p>}
        </article>

        <article className="panel">
          <div className="panelTitle"><div><span>Canonical guidance</span><h2>Remediation definition</h2></div></div>
          {remediation.length > 0 ? (
            <div className="detailList">
              {remediation.map(([name, value]) => <div key={`${name}-${value}`}><span>{name}</span><strong>{value}</strong></div>)}
            </div>
          ) : <p className="authMessage">No structured remediation fields are available for this finding.</p>}
        </article>
      </section>

      <section className="dashboardGrid">
        <article className="panel">
          <div className="panelTitle"><div><span>Evidence</span><h2>Observed security facts</h2></div></div>
          {detail.evidence.length > 0 ? (
            <div className="auditList">
              {detail.evidence.map((evidence) => (
                <div className="auditRow" key={evidence.evidence_id}>
                  <span className="moduleIcon"><ShieldCheck size={15} /></span>
                  <div><strong>{label(evidence.kind)}</strong><p>{evidence.summary}</p></div>
                  <span className="modulePhase">{label(evidence.classification)}</span>
                </div>
              ))}
            </div>
          ) : <p className="authMessage">No linked evidence records are available.</p>}
        </article>

        <article className="panel">
          <div className="panelTitle"><div><span>Occurrences</span><h2>Observation history</h2></div></div>
          {detail.occurrences.length > 0 ? (
            <div className="auditList">
              {detail.occurrences.map((occurrence) => (
                <div className="auditRow" key={occurrence.id}>
                  <span className="moduleIcon"><FileClock size={15} /></span>
                  <div><strong>{formatDate(occurrence.observed_at)}</strong><p>{occurrence.source_id} · {label(occurrence.validation_state)}</p></div>
                </div>
              ))}
            </div>
          ) : <p className="authMessage">No occurrence records are available.</p>}
        </article>
      </section>

      <section className="panel assetPanel">
        <div className="panelTitle"><div><span>Lifecycle history</span><h2>Append-only events</h2></div></div>
        {detail.events.length > 0 ? (
          <div className="auditList">
            {detail.events.map((event) => (
              <div className="auditRow" key={event.id}>
                <span className="moduleIcon"><Clock3 size={15} /></span>
                <div>
                  <strong>{label(event.event_type.replaceAll(".", " "))}</strong>
                  <p>
                    {event.from_lifecycle ? label(event.from_lifecycle) : "created"}
                    {" -> "}
                    {event.to_lifecycle ? label(event.to_lifecycle) : "unchanged"}
                    {event.reason ? ` · ${event.reason}` : ""}
                  </p>
                </div>
                <span className="modulePhase">{formatDate(event.created_at)}</span>
              </div>
            ))}
          </div>
        ) : <p className="authMessage">No lifecycle events are available.</p>}
      </section>
    </AppShell>
  );
}
