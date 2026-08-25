import Link from "next/link";
import { ArrowRight, Bug, CircleCheck, Clock3, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import { createSecurityFindingRepository } from "@/lib/security-findings/repository";
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

export default async function FindingsPage() {
  const { supabase, workspace, role, displayName } = await getDashboardContext();
  const repository = createSecurityFindingRepository(supabase);
  const findings = await repository.listWorkspaceFindings(workspace.id);

  const assetIds = [...new Set(findings.map((finding) => finding.asset_id))];
  const assetNames = new Map<string, string>();
  if (assetIds.length > 0) {
    const { data: assets, error } = await supabase
      .from("assets")
      .select("id,name")
      .eq("workspace_id", workspace.id)
      .in("id", assetIds);
    if (error) throw new Error("Unable to load finding assets.");
    for (const asset of assets ?? []) assetNames.set(asset.id, asset.name);
  }

  const activeCount = findings.filter((finding) =>
    !["verified_fixed", "accepted_risk", "false_positive"].includes(finding.lifecycle_state)).length;
  const validatedCount = findings.filter((finding) => finding.validation_state === "runtime_validated").length;
  const resolvedCount = findings.filter((finding) => finding.lifecycle_state === "resolved").length;

  return (
    <AppShell displayName={displayName} workspaceName={workspace.name} role={role}>
      <section className="pageHeader">
        <div>
          <span className="sectionEyebrow">Security ledger</span>
          <h1>Findings</h1>
          <p>Review canonical findings produced by authorized runtime observation and validation. Evidence and lifecycle history stay workspace-scoped and auditable.</p>
        </div>
        <div className="healthBadge"><ShieldCheck size={16} /> RLS protected</div>
      </section>

      <section className="grid4 assetSummaryGrid">
        <article className="statCard"><div><span>Total findings</span><Bug size={18} /></div><strong>{findings.length}</strong><small>Canonical workspace records</small></article>
        <article className="statCard"><div><span>Open work</span><Clock3 size={18} /></div><strong>{activeCount}</strong><small>Requires review or remediation</small></article>
        <article className="statCard"><div><span>Runtime validated</span><ShieldCheck size={18} /></div><strong>{validatedCount}</strong><small>Confirmed by bounded active validation</small></article>
        <article className="statCard"><div><span>Resolved</span><CircleCheck size={18} /></div><strong>{resolvedCount}</strong><small>May reopen if observed again</small></article>
      </section>

      <section className="panel assetPanel">
        <div className="panelTitle">
          <div><span>Workspace findings</span><h2>Newest observations first</h2></div>
        </div>
        {findings.length === 0 ? (
          <div className="emptyState">
            <span className="emptyIcon"><ShieldCheck size={23} /></span>
            <h3>No hosted findings yet</h3>
            <p>Authorized runtime jobs will add canonical findings here when deterministic rules identify security-relevant evidence.</p>
            <Link className="secondaryButton compact" href="/dashboard/assets">Review authorized assets <ArrowRight size={15} /></Link>
          </div>
        ) : (
          <div className="assetList">
            {findings.map((finding) => (
              <Link
                className="assetRow"
                href={`/dashboard/findings/${encodeURIComponent(finding.finding_id)}`}
                key={finding.finding_id}
              >
                <span className={`severity ${finding.severity === "critical" ? "high" : finding.severity}`} aria-hidden="true" />
                <div className="assetMain">
                  <strong>{finding.title}</strong>
                  <span>{assetNames.get(finding.asset_id) ?? finding.asset_id}</span>
                </div>
                <span className="assetKind">{label(finding.severity)} · {label(finding.confidence)}</span>
                <div className="assetState">
                  <strong>{label(finding.lifecycle_state)}</strong>
                  <small>{label(finding.validation_state)} · {finding.source_id}</small>
                </div>
                <div className="assetState">
                  <strong>Last {formatDate(finding.last_seen_at)}</strong>
                  <small>First {formatDate(finding.first_seen_at)}</small>
                </div>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
