import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import { PROVIDER_RUNTIME_READINESS, runtimeReadinessSummary } from "@/lib/provider-runtime/readiness";
import styles from "@/app/dashboard/security-runs/security-runs.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Security runs design preview", robots: { index: false, follow: false } };

const sampleRuns = [
  { id: "37fb0091-a7b2-4a33-8a24-6136deb61143", asset: "Customer portal", status: "completed", stop: "request budget exhausted", updated: "24 Sep 2026, 07:42" },
  { id: "2409c669-306b-4a7f-bf83-e3bcf1efc0cc", asset: "Payments API", status: "failed", stop: "provider failure limit", updated: "23 Sep 2026, 22:18" },
] as const;

export default function SecurityRunsPreview() {
  if (process.env.VERCEL_ENV !== "preview" && process.env.NODE_ENV !== "development") notFound();
  const readiness = runtimeReadinessSummary();

  return (
    <AppShell displayName="Preview user" workspaceName="Example workspace" role="preview" platformAdminHref="/preview/admin?view=providers">
      <div className="saasPreviewNotice">
        <span><strong>Design preview</strong> · Synthetic run data. No provider execution is available from this page.</span>
        <Link href="/preview/dashboard">Dashboard preview</Link>
      </div>
      <div className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>AUTOMATED SECURITY ENGINE</span>
            <h1>Security runs</h1>
            <p>Understand what ScopeForge planned, executed and observed, while provider readiness remains explicit and fail-closed.</p>
          </div>
          <span className={styles.heroBadge}><ShieldCheck size={14} aria-hidden="true" /> Authorization first</span>
        </header>
        <section className={styles.metricGrid}>
          <article className={styles.metric}><span>Recorded runs</span><strong>2</strong><small>Synthetic preview records</small></article>
          <article className={styles.metric}><span>Completed</span><strong>1</strong><small>One accepted terminal run</small></article>
          <article className={styles.metric}><span>Active</span><strong>0</strong><small>No synthetic active work</small></article>
          <article className={styles.metric}><span>External enabled</span><strong>{readiness.enabledExternal}</strong><small>httpx and Nuclei remain default-off</small></article>
        </section>
        <section className={styles.grid}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}><div><span className={styles.panelKicker}>Workspace history</span><h2>Recent security runs</h2></div></div>
            <div className={styles.runList}>
              {sampleRuns.map((run) => (
                <article className={styles.run} key={run.id}>
                  <div className={styles.runTop}><div><h3>{run.asset}</h3><p>Run {run.id}</p></div><span className={run.status === "completed" ? `${styles.status} ${styles.statusGood}` : `${styles.status} ${styles.statusWarn}`}>{run.status}</span></div>
                  <div className={styles.runMeta}><span>Updated {run.updated}</span><span>Stop: {run.stop}</span><span>Details require sign-in <ArrowRight size={11} aria-hidden="true" /></span></div>
                </article>
              ))}
            </div>
          </article>
          <aside className={styles.panel}>
            <div className={styles.panelHeader}><div><span className={styles.panelKicker}>Execution availability</span><h2>Provider runtime</h2></div></div>
            <div className={styles.providerList}>
              {PROVIDER_RUNTIME_READINESS.map((provider) => (
                <article className={styles.provider} key={provider.providerId}>
                  <div className={styles.providerTop}><div><h3>{provider.displayName}</h3><p>{provider.providerId} · v{provider.version}</p></div><span className={provider.enabled ? `${styles.status} ${styles.statusGood}` : `${styles.status} ${styles.statusWarn}`}>{provider.enabled ? "Operational" : "Validation only"}</span></div>
                  <p>{provider.summary}</p>
                </article>
              ))}
            </div>
          </aside>
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><span className={styles.panelKicker}>How the engine works</span><h2>From authorization to evidence</h2></div></div>
          <div className={styles.flow}>
            <article className={styles.flowStep}><span>01</span><strong>Authorize</strong><p>Verified scope and immutable authorization.</p></article>
            <article className={styles.flowStep}><span>02</span><strong>Plan</strong><p>Bounded hypotheses and policy decisions.</p></article>
            <article className={styles.flowStep}><span>03</span><strong>Execute</strong><p>Accepted runtime with hard ceilings.</p></article>
            <article className={styles.flowStep}><span>04</span><strong>Reduce evidence</strong><p>Compact observations and explicit coverage.</p></article>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
