import type { Metadata } from "next";
import {
  CheckCircle2,
  CircleDashed,
  LockKeyhole,
  Network,
  PackageCheck,
  ServerCog,
} from "lucide-react";
import AdminMetricCard from "@/components/platform-admin/AdminMetricCard";
import AdminPageHeader from "@/components/platform-admin/AdminPageHeader";
import {
  PHASE12_NEXT_RUNTIME,
  PROVIDER_RUNTIME_READINESS,
  runtimeReadinessSummary,
  type RuntimeGateState,
} from "@/lib/provider-runtime/readiness";

export const metadata: Metadata = { title: "Provider runtime" };
export const dynamic = "force-dynamic";

function gateIcon(state: RuntimeGateState) {
  if (state === "passed") return <CheckCircle2 size={15} aria-hidden="true" />;
  if (state === "pending") return <CircleDashed size={15} aria-hidden="true" />;
  return <LockKeyhole size={15} aria-hidden="true" />;
}

function gateClass(state: RuntimeGateState): string {
  if (state === "passed") return "adminStatusGood";
  if (state === "pending") return "adminStatusWarn";
  return "adminMuted";
}

export default function ProviderRuntimePage() {
  const summary = runtimeReadinessSummary();

  return (
    <>
      <AdminPageHeader
        eyebrow="Execution control plane"
        title="Provider runtime"
        description="A release-truth view of what ScopeForge can actually execute. Source-complete providers stay visibly locked until their own Linux containment, worker routing and bounded production acceptance gates pass."
        actions={<span className="adminBadge adminBadgeActive">Fail closed by default</span>}
      />

      <section className="adminMetricGrid" aria-label="Provider runtime summary">
        <AdminMetricCard label="Operational" value={String(summary.operational)} hint="Accepted runtime providers" icon={ServerCog} />
        <AdminMetricCard label="External prepared" value={String(summary.preparedExternal)} hint="Source-ready, default-off" icon={PackageCheck} />
        <AdminMetricCard label="External enabled" value={String(summary.enabledExternal)} hint="Production external providers" icon={Network} />
        <AdminMetricCard label="Containment pending" value={String(summary.pendingContainment)} hint="Require real Linux evidence" icon={CircleDashed} />
      </section>

      <section className="adminSection" aria-labelledby="provider-readiness-heading">
        <h2 id="provider-readiness-heading">Runtime readiness</h2>
        <div className="adminPanelGrid">
          {PROVIDER_RUNTIME_READINESS.map((provider) => (
            <article className={provider.availability === "operational" ? "adminPanel adminPanelPrimary" : "adminPanel"} key={provider.providerId}>
              <div className="adminPanelHeading">
                <div>
                  <span className="adminPanelKicker">{provider.providerId}</span>
                  <h2>{provider.displayName}</h2>
                </div>
                <span className={provider.availability === "operational" ? "adminBadge adminBadgeActive" : "adminBadge"}>
                  {provider.availability === "operational" ? "Operational" : "Validation only"}
                </span>
              </div>
              <p>{provider.summary}</p>
              <div className="adminStatusRows">
                <div className="adminStatusRow"><span>Version</span><strong>{provider.version}</strong></div>
                <div className="adminStatusRow"><span>Production execution</span><strong className={provider.enabled ? "adminStatusGood" : "adminStatusWarn"}>{provider.enabled ? "Enabled" : "Disabled"}</strong></div>
                <div className="adminStatusRow"><span>Capabilities</span><strong>{provider.capabilityIds.join(", ")}</strong></div>
              </div>
              <div className="adminActionCard" style={{ marginTop: 12 }}>
                <h3>Safety boundary</h3>
                <p>{provider.safetyBoundary}</p>
              </div>
              <div className="adminStatusRows" style={{ marginTop: 12 }}>
                {provider.gates.map((gate) => (
                  <div className="adminStatusRow" key={gate.id} title={gate.detail}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      {gateIcon(gate.state)}
                      {gate.label}
                    </span>
                    <strong className={gateClass(gate.state)}>
                      {gate.state === "passed" ? "Passed" : gate.state === "pending" ? "Pending" : "Locked"}
                    </strong>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="adminPanelGrid">
        <article className="adminPanel adminPanelPrimary">
          <div className="adminPanelHeading">
            <div>
              <span className="adminPanelKicker">Execution path</span>
              <h2>What the provider can reach</h2>
            </div>
          </div>
          <div className="adminStatusRows">
            <div className="adminStatusRow"><span>1. Authorization</span><strong>Exact workspace target</strong></div>
            <div className="adminStatusRow"><span>2. Host mediator</span><strong>DNS/IP policy + budgets</strong></div>
            <div className="adminStatusRow"><span>3. Trusted sidecar</span><strong>Networkless namespace</strong></div>
            <div className="adminStatusRow"><span>4. Provider</span><strong>No host socket or nonce</strong></div>
            <div className="adminStatusRow"><span>5. Evidence</span><strong>Reduced + bounded</strong></div>
          </div>
        </article>
        <article className="adminPanel">
          <div className="adminPanelHeading">
            <div>
              <span className="adminPanelKicker">{PHASE12_NEXT_RUNTIME.slice}</span>
              <h2>{PHASE12_NEXT_RUNTIME.title}</h2>
            </div>
            <span className="adminBadge">Planned</span>
          </div>
          <p>{PHASE12_NEXT_RUNTIME.detail}</p>
          <div className="adminActionMessage">
            No network-discovery provider is enabled merely because an adapter exists. Licensing, containment and operational acceptance remain separate gates.
          </div>
        </article>
      </section>
    </>
  );
}
