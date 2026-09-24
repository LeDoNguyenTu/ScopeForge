import Link from "next/link";
import { ArrowRight, Radar, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import CapabilityRoadmap from "@/components/security-runs/CapabilityRoadmap";
import ProviderRuntimeCard from "@/components/security-runs/ProviderRuntimeCard";
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

export default async function SecurityRunsPage() {
  const { supabase, workspace, role, displayName } = await getDashboardContext();
  const [platformAdmin, runs, assetResult] = await Promise.all([
    getOptionalPlatformAdmin(),
    listPentestRunSummaries(supabase as unknown as Phase11ReadClient, workspace.id, 20),
    supabase.from("assets").select("id,name").eq("workspace_id", workspace.id),
  ]);
  if (assetResult.error) throw new Error(assetResult.error.message);

  const assetNames = new Map((assetResult.data ?? []).map((asset) => [asset.id, asset.name]));
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
              Follow each authorized pentest from scope and planning through execution, coverage and reduced evidence.
              Runtime readiness stays visible beside run history so prepared providers are never mistaken for production capability.
            </p>
          </div>
          <span className={styles.heroBadge}><ShieldCheck size={14} aria-hidden="true" /> Authorization first</span>
        </header>

        <section className={styles.metricGrid} aria-label="Security run summary">
          <article className={styles.metric}><span>Recorded runs</span><strong>{runs.length}</strong><small>Most recent 20 in this workspace</small></article>
          <article className={styles.metric}><span>Completed</span><strong>{completed}</strong><small>Terminal successful run records</small></article>
          <article className={styles.metric}><span>Active</span><strong>{active}</strong><small>Created, running or awaiting approval</small></article>
          <article className={styles.metric}><span>External enabled</span><strong>{readiness.enabledExternal}</strong><small>{readiness.preparedExternal} external runtimes remain validation-only</small></article>
        </section>

        <section className={styles.engineBanner} aria-label="Current engine capability">
          <div>
            <span className={styles.panelKicker}>What ScopeForge can execute now</span>
            <h2>{readiness.operational} operational runtime, {readiness.preparedExternal} external runtimes under validation</h2>
            <p>
              The accepted first-party HTTP runtime is available now. httpx and Nuclei are visible because their source boundaries exist,
              but remain locked until real Linux containment and later operational gates pass.
            </p>
          </div>
          {platformAdmin ? <Link href="/admin/providers">Open provider control plane <ArrowRight size={13} aria-hidden="true" /></Link> : null}
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
                <p>When an authorized run exists, this page will show its bounded planning, execution, coverage and observation story.</p>
              </div>
            ) : (
              <div className={styles.runList}>
                {runs.map((run) => (
                  <Link className={styles.run} href={`/dashboard/security-runs/${run.run_id}`} key={run.run_id}>
                    <div className={styles.runTop}>
                      <div>
                        <h3>{assetNames.get(run.root_asset_id) ?? "Authorized asset"}</h3>
                        <p>Run {run.run_id}</p>
                      </div>
                      <span className={statusClass(run.status)}>{run.status.replaceAll("_", " ")}</span>
                    </div>
                    <div className={styles.runMeta}>
                      <span>Updated {new Date(run.updated_at).toLocaleString()}</span>
                      <span>{run.stop_reason ? `Stop: ${run.stop_reason.replaceAll("_", " ")}` : "No stop reason recorded"}</span>
                      <span>Open full run story <ArrowRight size={11} aria-hidden="true" /></span>
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
              {PROVIDER_RUNTIME_READINESS.map((provider) => (
                <ProviderRuntimeCard compact key={provider.providerId} provider={provider} />
              ))}
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

        <CapabilityRoadmap />
      </div>
    </AppShell>
  );
}
