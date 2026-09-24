import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  LockKeyhole,
  Radar,
  ShieldCheck,
} from "lucide-react";

export interface DashboardSecurityEngineState {
  recentRunCount: number;
  operationalRuntimes: number;
  validatingRuntimes: number;
  enabledExternalRuntimes: number;
  latestRun: {
    runId: string;
    status: string;
    stopReason: string | null;
    updatedAt: string;
  } | null;
}

function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

export default function SecurityEngineSnapshot({
  engine,
}: {
  engine: DashboardSecurityEngineState;
}) {
  const latest = engine.latestRun;
  const externalLocked = engine.enabledExternalRuntimes === 0;

  return (
    <section className="saasEnginePanel" aria-labelledby="dashboard-security-engine-heading">
      <div className="saasEngineHeader">
        <div>
          <span className="saasEyebrow">AUTOMATED SECURITY ENGINE</span>
          <h2 id="dashboard-security-engine-heading">What ScopeForge can execute</h2>
          <p>
            Runtime availability, recent execution and provider gates are shown here from the same
            server-owned state that drives Security Runs.
          </p>
        </div>
        <Link className="saasEngineCta" href="/dashboard/security-runs">
          Open security runs <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>

      <div className="saasEngineMetrics" aria-label="Security engine status">
        <div>
          <span><Radar size={14} aria-hidden="true" /> Recent run records</span>
          <strong>{engine.recentRunCount}</strong>
          <small>Latest workspace summaries</small>
        </div>
        <div>
          <span><CheckCircle2 size={14} aria-hidden="true" /> Operational runtimes</span>
          <strong>{engine.operationalRuntimes}</strong>
          <small>Accepted for bounded execution</small>
        </div>
        <div>
          <span><CircleDashed size={14} aria-hidden="true" /> Under validation</span>
          <strong>{engine.validatingRuntimes}</strong>
          <small>Prepared but not production enabled</small>
        </div>
        <div>
          <span><LockKeyhole size={14} aria-hidden="true" /> External enabled</span>
          <strong>{engine.enabledExternalRuntimes}</strong>
          <small>{externalLocked ? "External providers remain fail-closed" : "Production external runtime count"}</small>
        </div>
      </div>

      <div className="saasEngineBody">
        <div className="saasEngineLatest">
          <div className="saasEngineSectionHeading">
            <div>
              <span className="saasEyebrow">LATEST EXECUTION</span>
              <h3>{latest ? humanize(latest.status) : "No security run recorded yet"}</h3>
            </div>
            {latest ? <span className="saasEngineStatus">{humanize(latest.status)}</span> : null}
          </div>
          {latest ? (
            <>
              <p>
                Run <span className="saasEngineCode">{latest.runId}</span>
              </p>
              <div className="saasEngineFacts">
                <span>Updated {new Date(latest.updatedAt).toLocaleString()}</span>
                <span>{latest.stopReason ? `Stop: ${humanize(latest.stopReason)}` : "No stop reason recorded"}</span>
              </div>
            </>
          ) : (
            <p>
              Authorized runs will appear here once the workspace has execution history. Provider
              readiness is still visible even before the first run.
            </p>
          )}
        </div>

        <div className="saasEnginePipeline" aria-label="Automated security execution pipeline">
          <span className="saasEyebrow">ENGINE PIPELINE</span>
          <div>
            <span><ShieldCheck size={14} aria-hidden="true" /><strong>Authorize</strong><small>Verified scope</small></span>
            <i aria-hidden="true" />
            <span><Radar size={14} aria-hidden="true" /><strong>Plan</strong><small>Bounded actions</small></span>
            <i aria-hidden="true" />
            <span><CircleDashed size={14} aria-hidden="true" /><strong>Execute</strong><small>Accepted runtime</small></span>
            <i aria-hidden="true" />
            <span><CheckCircle2 size={14} aria-hidden="true" /><strong>Evidence</strong><small>Reduced observations</small></span>
          </div>
        </div>
      </div>

      {externalLocked ? (
        <div className="saasEngineTruth">
          <LockKeyhole size={15} aria-hidden="true" />
          <p>
            External httpx and Nuclei capability is visible for transparency, but production execution
            stays disabled until their Linux containment, worker-routing and canary gates pass.
          </p>
        </div>
      ) : null}
    </section>
  );
}
