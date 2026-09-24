import Link from "next/link";
import { ArrowRight, Radar, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import { getOptionalPlatformAdmin } from "@/lib/platform-admin/authorization";
import { listPentestRunSummaries } from "@/lib/pentest-runs/read-model";
import type { Phase11ReadClient } from "@/lib/database.phase11.types";
import {
  PROVIDER_RUNTIME_READINESS,
  runtimeReadinessSummary,
} from "@/lib/provider-runtime/readiness";
import { getDashboardContext } from "@/lib/workspaces/current";
import styles from "./security-runs.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Security runs" };

function statusClass(status: string): string {
  return status === "completed" ? `${styles.status} ${styles.statusGood}`
    : status === "failed" || status === "cancelled" ? `${styles.status} ${styles.statusWarn}`
      : styles.status;
}

function providerStatus(provider: (typeof PROVIDER_RUNTIME_READINESS)[number]) {
  return provider.availability === "operational"
    ? { label: "Operational", className: `${styles.status} ${styles.statusGood}` }
    : { label: "Validation only", className: `${styles.status} ${styles.statusWarn}` };
}

export default async function SecurityRunsPage() {
  const { supabase, workspace, role, displayName } = await getDashboardContext();
  const [platformAdmin, runs] = await Promise.all([
    getOptionalPlatformAdmin(),
    listPentestRunSummaries(supabase as unknown as Phase11ReadClient, workspace.id, 20),
  ]);
  const readiness = runtimeReadinessSummary();
  const completed = runs.filter((run) => run.status === "completed").length;
  const active = runs.filter((run) => run.status === "created" || run.status === "running" || run.status === "waiting_approval").length;

  return (
    <AppShell
      displayName={displayName}
      workspaceName={workspace.name}
      role={role}
      platformAdminHref={platformAdmin ? "/admin" : undefined}
    >
      <div className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>AUTOMATED SECURITY ENGINE</span>
            <h1>Security runs</h1>
            <p>
              See what ScopeForge actually planned, executed and observed against this workspace.
              Runtime availability is shown separately so source-ready providers are never presented as production-ready.
            </p>
          </div>
          <span className={styles.heroBadge}><ShieldCheck size={14} aria-hidden="true" /> Authorization first</span>
        </header>

        <section className={styles.metricGrid} aria-label="Security run summary">
          <article className={styles.metric}><span>Recorded runs</span><strong>{runs.length}</strong><small>Most recent 20 in this workspace</small></article>
          <article className={styles.metric}><span>Completed</span><strong>{completed}</strong><small>Terminal successful run records</small></article>
          <article className={styles.metric}><span>Active</span><strong>{active}</strong><small>Created, running or awaiting approval</small></article>
          <article className={styles.metric}><span>External enabled</span><strong>{readiness.enabledExternal}</strong><small>httpx and Nuclei remain default-off</small></article>
        </section>

        <section className={styles.grid}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelKicker}>Workspace history</span>
                <h2>Recent security runs</h2>
              </div>
              <Radar size={18} aria-hidden="true" />
            </div>
            {runs.length === 0 ? (
              <div className={styles.empty}>
                <strong>No security runs recorded yet</strong>
                <p>ScopeForge will show bounded planning, execution, coverage and observation summaries here when an authorized run exists.</p>
              </div>
            ) : (
              <div className={styles.runList}>
                {runs.map((run) => (
                  <Link className={styles.run} href={`/dashboard/security-runs/${run.run_id}`} key={run.run_id}>
                    <div className={styles.runTop}>
                      <div>
                        <h3>{run.root_asset_id}</h3>
                        <p>Run {run.run_id}</p>
                      </div>
                      <span className={statusClass(run.status)}>{run.status.replaceAll("_", " ")}</span>
                    </div>
                    <div className={styles.runMeta}>
                      <span>Updated {new Date(run.updated_at).toLocaleString()}</span>
                      <span>{run.stop_reason ? `Stop: ${run.stop_reason.replaceAll("_", " ")}` : "No stop reason recorded"}</span>
                      <span>Open details <ArrowRight size={11} aria-hidden="true" /></span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </article>

          <aside className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelKicker}>Execution availability</span>
                <h2>Provider runtime</h2>
              </div>
            </div>
            <div className={styles.providerList}>
              {PROVIDER_RUNTIME_READINESS.map((provider) => {
                const status = providerStatus(provider);
                return (
                  <article className={styles.provider} key={provider.providerId}>
                    <div className={styles.providerTop}>
                      <div>
                        <h3>{provider.displayName}</h3>
                        <p>{provider.providerId} · v{provider.version}</p>
                      </div>
                      <span className={status.className}>{status.label}</span>
                    </div>
                    <p>{provider.summary}</p>
                  </article>
                );
              })}
            </div>
          </aside>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.panelKicker}>How the engine works</span>
              <h2>From authorization to evidence</h2>
            </div>
          </div>
          <div className={styles.flow}>
            <article className={styles.flowStep}><span>01</span><strong>Authorize</strong><p>Bind the run to verified workspace scope and an immutable authorization snapshot.</p></article>
            <article className={styles.flowStep}><span>02</span><strong>Plan</strong><p>Generate bounded hypotheses and capability actions, then reject anything outside policy.</p></article>
            <article className={styles.flowStep}><span>03</span><strong>Execute</strong><p>Use only an accepted runtime with request, time, network and resource ceilings.</p></article>
            <article className={styles.flowStep}><span>04</span><strong>Reduce evidence</strong><p>Persist compact observations and coverage without exposing raw provider authority.</p></article>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
