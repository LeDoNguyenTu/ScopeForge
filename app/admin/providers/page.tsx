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
  PHASE12_RUNTIME_ROADMAP,
  PROVIDER_RUNTIME_READINESS,
  providerGateSummary,
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

      <section className="adminProviderTruth" aria-label="Provider execution truth">
        <div>
          <span className="adminPanelKicker">Operator truth</span>
          <h2>Prepared does not mean enabled</h2>
          <p>
            The frontend mirrors the same fail-closed backend state. A provider becomes runnable only after every
            provider-specific acceptance gate passes and the corresponding control-plane route is released.
          </p>
        </div>
        <div className="adminProviderTruthStats">
          <span><strong>{summary.operational}</strong> operational</span>
          <span><strong>{summary.preparedExternal}</strong> validating</span>
          <span><strong>{summary.enabledExternal}</strong> external enabled</span>
        </div>
      </section>

      <section className="adminSection" aria-labelledby="provider-readiness-heading">
        <h2 id="provider-readiness-heading">Runtime readiness</h2>
        <div className="adminPanelGrid">
          {PROVIDER_RUNTIME_READINESS.map((provider) => {
            const gates = providerGateSummary(provider);
            return (
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

                <div className="adminProviderProgress">
                  <div>
                    <span>Acceptance gates</span>
                    <strong>{gates.passed} / {gates.total} passed</strong>
                  </div>
                  <div className="adminProviderProgressTrack" aria-label={`${gates.passed} of ${gates.total} provider gates passed`}>
                    {provider.gates.map((gate) => (
                      <span className={`adminProviderProgressSegment adminProviderProgress-${gate.state}`} key={gate.id} />
                    ))}
                  </div>
                  {gates.nextGate ? (
                    <small>Next blocker: <strong>{gates.nextGate.label}</strong></small>
                  ) : (
                    <small className="adminStatusGood">All release gates accepted.</small>
                  )}
                </div>

                <div className="adminStatusRows">
                  <div className="adminStatusRow"><span>Version</span><strong>{provider.version}</strong></div>
                  <div className="adminStatusRow"><span>Production execution</span><strong className={provider.enabled ? "adminStatusGood" : "adminStatusWarn"}>{provider.enabled ? "Enabled" : "Disabled"}</strong></div>
                  <div className="adminStatusRow"><span>Capabilities</span><strong>{provider.capabilityIds.join(", ")}</strong></div>
                </div>

                <div className="adminActionCard adminProviderBoundary">
                  <h3>Safety boundary</h3>
                  <p>{provider.safetyBoundary}</p>
                </div>

                <div className="adminStatusRows adminProviderGates">
                  {provider.gates.map((gate) => (
                    <div className="adminProviderGate" key={gate.id}>
                      <div className="adminProviderGateTop">
                        <span className="adminProviderGateLabel">
                          {gateIcon(gate.state)}
                          {gate.label}
                        </span>
                        <strong className={gateClass(gate.state)}>
                          {gate.state === "passed" ? "Passed" : gate.state === "pending" ? "Pending" : "Locked"}
                        </strong>
                      </div>
                      <small>{gate.detail}</small>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
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
          <div className="adminProviderFlow">
            <div><span>01</span><strong>Authorization</strong><small>Exact workspace target</small></div>
            <div><span>02</span><strong>Host mediator</strong><small>DNS/IP policy + budgets</small></div>
            <div><span>03</span><strong>Trusted sidecar</strong><small>Networkless namespace</small></div>
            <div><span>04</span><strong>Provider</strong><small>No host socket or nonce</small></div>
            <div><span>05</span><strong>Evidence</strong><small>Reduced + bounded</small></div>
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

      <section className="adminSection" aria-labelledby="phase12-roadmap-heading">
        <h2 id="phase12-roadmap-heading">Phase 12 capability expansion</h2>
        <div className="adminProviderRoadmap">
          {PHASE12_RUNTIME_ROADMAP.map((item) => (
            <article key={item.slice}>
              <div>
                <span className="adminPanelKicker">{item.slice}</span>
                <span className={item.state === "validation" ? "adminBadge adminBadgePending" : "adminBadge"}>
                  {item.state === "validation" ? "Validation" : "Planned"}
                </span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
