import Link from "next/link";
import { ArrowLeft, Network, Radar } from "lucide-react";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import type { Phase11ReadClient } from "@/lib/database.phase11.types";
import { getOptionalPlatformAdmin } from "@/lib/platform-admin/authorization";
import { loadPentestRunReadModel } from "@/lib/pentest-runs/read-model";
import { getDashboardContext } from "@/lib/workspaces/current";
import styles from "../security-runs.module.css";

export const dynamic = "force-dynamic";

function statusClass(status: string): string {
  return status === "completed" ? `${styles.status} ${styles.statusGood}`
    : status === "failed" || status === "cancelled" ? `${styles.status} ${styles.statusWarn}`
      : styles.status;
}

export default async function SecurityRunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const { supabase, workspace, role, displayName } = await getDashboardContext();
  const [platformAdmin, model] = await Promise.all([
    getOptionalPlatformAdmin(),
    loadPentestRunReadModel(supabase as unknown as Phase11ReadClient, workspace.id, runId),
  ]);
  if (!model) notFound();

  const coverage = model.coverage;
  return (
    <AppShell
      displayName={displayName}
      workspaceName={workspace.name}
      role={role}
      platformAdminHref={platformAdmin ? "/admin" : undefined}
    >
      <div className={styles.page}>
        <Link className={styles.back} href="/dashboard/security-runs"><ArrowLeft size={14} aria-hidden="true" /> Back to security runs</Link>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>RUN EVIDENCE</span>
            <div className={styles.detailHeader}>
              <h1>Security run</h1>
              <span className={statusClass(model.run.status)}>{model.run.status.replaceAll("_", " ")}</span>
            </div>
            <p className={styles.code}>{model.run.run_id}</p>
          </div>
          <span className={styles.heroBadge}><Radar size={14} aria-hidden="true" /> {model.observations.length} observations</span>
        </header>

        <section className={styles.metricGrid} aria-label="Run coverage">
          <article className={styles.metric}><span>Capabilities attempted</span><strong>{coverage?.attempted_capability_count ?? 0}</strong><small>Policy-approved execution classes</small></article>
          <article className={styles.metric}><span>Covered nodes</span><strong>{coverage?.covered_node_count ?? 0}</strong><small>{coverage?.untested_node_count ?? 0} nodes remain untested</small></article>
          <article className={styles.metric}><span>Requests</span><strong>{coverage?.request_count ?? 0}</strong><small>Authoritative accounted requests</small></article>
          <article className={styles.metric}><span>Provider failures</span><strong>{coverage?.provider_failure_count ?? 0}</strong><small>{coverage?.graph_expansion_count ?? 0} graph expansions</small></article>
        </section>

        <section className={styles.grid}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div><span className={styles.panelKicker}>Execution record</span><h2>Actions</h2></div>
              <Radar size={18} aria-hidden="true" />
            </div>
            {model.actions.length === 0 ? <div className={styles.empty}><strong>No action summaries</strong><p>This run has no public action summary rows.</p></div> : (
              <div className={styles.recordList}>
                {model.actions.map((action) => (
                  <article className={styles.record} key={action.action_id}>
                    <div className={styles.recordTop}>
                      <div><h3>{action.capability_id}</h3><p className={styles.code}>{action.action_id}</p></div>
                      <span className={styles.status}>{action.state.replaceAll("_", " ")}</span>
                    </div>
                    <div className={styles.recordMeta}>
                      <span>Mode {action.requested_mode.replaceAll("_", " ")}</span>
                      <span>{action.target_node_ids.length} target node{action.target_node_ids.length === 1 ? "" : "s"}</span>
                      <span>Updated {new Date(action.updated_at).toLocaleString()}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>

          <aside className={styles.panel}>
            <div className={styles.panelHeader}><div><span className={styles.panelKicker}>Run boundary</span><h2>Authoritative summary</h2></div></div>
            <div className={styles.factList}>
              <div className={styles.fact}><span>Root asset</span><strong className={styles.code}>{model.run.root_asset_id}</strong></div>
              <div className={styles.fact}><span>Stop reason</span><strong>{model.run.stop_reason?.replaceAll("_", " ") ?? "Not recorded"}</strong></div>
              <div className={styles.fact}><span>Graph nodes</span><strong>{model.graphNodes.length}</strong></div>
              <div className={styles.fact}><span>Graph edges</span><strong>{model.graphEdges.length}</strong></div>
              <div className={styles.fact}><span>Hypotheses</span><strong>{model.hypotheses.length}</strong></div>
              <div className={styles.fact}><span>Started</span><strong>{coverage ? new Date(coverage.started_at).toLocaleString() : "Not recorded"}</strong></div>
              <div className={styles.fact}><span>Deadline</span><strong>{coverage ? new Date(coverage.deadline_at).toLocaleString() : "Not recorded"}</strong></div>
            </div>
          </aside>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div><span className={styles.panelKicker}>Normalized evidence</span><h2>Observations</h2></div>
            <Network size={18} aria-hidden="true" />
          </div>
          {model.observations.length === 0 ? <div className={styles.empty}><strong>No observations persisted</strong><p>A legitimate no-signal result can still be a valid bounded run outcome.</p></div> : (
            <div className={styles.recordList}>
              {model.observations.map((observation) => (
                <article className={styles.record} key={observation.observation_id}>
                  <div className={styles.recordTop}>
                    <div><h3>{observation.capability_id}</h3><p>{observation.provider_id} · v{observation.provider_version}</p></div>
                    <span className={styles.status}>{observation.execution_mode.replaceAll("_", " ")}</span>
                  </div>
                  <div className={styles.recordMeta}>
                    <span>Confidence {Math.round(observation.confidence * 100)}%</span>
                    <span>{observation.asset_node_ids.length} asset node{observation.asset_node_ids.length === 1 ? "" : "s"}</span>
                    <span>{new Date(observation.observed_at).toLocaleString()}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
