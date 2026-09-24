import {
  HTTP_DISCOVERY_CAPABILITIES,
  HTTP_DISCOVERY_PROVIDER_ID,
  HTTP_DISCOVERY_PROVIDER_VERSION,
} from "@/packages/provider-http-discovery";
import {
  HTTPX_CAPABILITY,
  HTTPX_PROVIDER_ID,
  HTTPX_PROVIDER_VERSION,
} from "@/packages/provider-httpx";
import {
  NUCLEI_CAPABILITY,
  NUCLEI_PROVIDER_ID,
  NUCLEI_PROVIDER_VERSION,
} from "@/packages/provider-nuclei";
import {
  NUCLEI_BASELINE_TEMPLATE_ID,
  NUCLEI_TEMPLATES_RELEASE,
} from "@/packages/provider-nuclei/runtime-profile";

export type RuntimeGateState = "passed" | "pending" | "locked";
export type RuntimeAvailability = "operational" | "validation" | "planned";

export interface RuntimeGate {
  id: string;
  label: string;
  state: RuntimeGateState;
  detail: string;
}

export interface ProviderRuntimeReadiness {
  providerId: string;
  displayName: string;
  version: string;
  availability: RuntimeAvailability;
  enabled: boolean;
  capabilityIds: readonly string[];
  summary: string;
  safetyBoundary: string;
  gates: readonly RuntimeGate[];
}

const nativeHttpGates: readonly RuntimeGate[] = Object.freeze([
  { id: "authorization", label: "Target authorization", state: "passed", detail: "Verified workspace asset and immutable authorization snapshot." },
  { id: "worker", label: "Dedicated worker", state: "passed", detail: "Production Phase 11 HTTP worker class is operationally accepted." },
  { id: "containment", label: "Linux containment", state: "passed", detail: "Rootless Podman, cgroup v2, target-bound mediator and cleanup evidence accepted." },
  { id: "budget", label: "Request and runtime budget", state: "passed", detail: "Server-owned request and wall-time ceilings are enforced." },
  { id: "production", label: "Production acceptance", state: "passed", detail: "Bounded production canary completed with reconciled evidence." },
]);

const externalCommonGates: readonly RuntimeGate[] = Object.freeze([
  { id: "supply-chain", label: "Pinned supply chain", state: "passed", detail: "Reviewed release artifacts are checksum-pinned." },
  { id: "closed-profile", label: "Closed execution profile", state: "passed", detail: "No arbitrary URLs, native flags, proxies or generic shell input." },
  { id: "egress", label: "Target-bound egress", state: "passed", detail: "Host-owned exact-target policy and networkless Unix tunnel are implemented." },
  { id: "sandbox", label: "Two-container sandbox", state: "passed", detail: "Provider shares only the trusted sidecar network namespace and never receives the host tunnel nonce." },
  { id: "ci", label: "Exact-head source gate", state: "passed", detail: "Security-sensitive source passed the full repository CI gate." },
  { id: "linux", label: "Real Linux containment", state: "pending", detail: "Must pass on the accepted Linux/Oracle worker with immutable image identities." },
  { id: "control-plane", label: "Dedicated worker route", state: "locked", detail: "No Phase 12 worker class, queue route or database enablement exists yet." },
  { id: "canary", label: "Production canary", state: "locked", detail: "Blocked until containment and control-plane review are complete." },
]);

export const PROVIDER_RUNTIME_READINESS: readonly ProviderRuntimeReadiness[] = Object.freeze([
  {
    providerId: HTTP_DISCOVERY_PROVIDER_ID,
    displayName: "ScopeForge HTTP discovery",
    version: HTTP_DISCOVERY_PROVIDER_VERSION,
    availability: "operational",
    enabled: true,
    capabilityIds: HTTP_DISCOVERY_CAPABILITIES,
    summary: "The accepted first-party target-bound HTTP runtime used by Phase 11.",
    safetyBoundary: "Verified targets only, bounded routes and requests, server-owned authorization and evidence reduction.",
    gates: nativeHttpGates,
  },
  {
    providerId: HTTPX_PROVIDER_ID,
    displayName: "ProjectDiscovery httpx",
    version: HTTPX_PROVIDER_VERSION,
    availability: "validation",
    enabled: false,
    capabilityIds: Object.freeze([HTTPX_CAPABILITY]),
    summary: "External HTTP probing is source-complete behind the hardened two-container provider boundary, but remains unavailable to production runs.",
    safetyBoundary: "Immutable image, exact target binding, networkless sidecar namespace, fixed SOCKS boundary, bounded probes and no arbitrary provider flags.",
    gates: externalCommonGates,
  },
  {
    providerId: NUCLEI_PROVIDER_ID,
    displayName: "ProjectDiscovery Nuclei",
    version: NUCLEI_PROVIDER_VERSION,
    availability: "validation",
    enabled: false,
    capabilityIds: Object.freeze([NUCLEI_CAPABILITY]),
    summary: `Safe-active template execution is prepared with the ${NUCLEI_TEMPLATES_RELEASE} reviewed snapshot and one baseline template, but remains unavailable to production runs.`,
    safetyBoundary: `Allowlist-only profile using ${NUCLEI_BASELINE_TEMPLATE_ID}; redirects, OAST, internal httpx, update checks and broad template execution stay disabled.`,
    gates: externalCommonGates,
  },
]);

export const PHASE12_RUNTIME_ROADMAP = Object.freeze([
  { slice: "12A", title: "External HTTP probing", state: "validation" as const, detail: "ProjectDiscovery httpx is source-ready but still blocked on real Linux containment, worker routing and production acceptance." },
  { slice: "12B", title: "Safe-active template checks", state: "validation" as const, detail: "Nuclei is constrained to the reviewed baseline allowlist and remains default-off until its own acceptance gate passes." },
  { slice: "12C", title: "Network and service discovery", state: "planned" as const, detail: "Provider-neutral discovery design is next. Nmap enablement remains blocked pending licensing and runtime review." },
  { slice: "12D", title: "Authenticated browser and API runtime", state: "planned" as const, detail: "Session-bearing browser and API execution stays separately gated behind explicit credential and target authority." },
  { slice: "12E", title: "Bounded web and API DAST", state: "planned" as const, detail: "Broader active testing will reuse the same authorization, containment, cancellation and evidence boundaries." },
  { slice: "12F", title: "Proof-only validators", state: "planned" as const, detail: "Validation expands only through narrow proof contracts, never unrestricted exploit or post-exploitation authority." },
  { slice: "12G", title: "Adaptive provider orchestration", state: "planned" as const, detail: "The planner will correlate accepted providers while preserving independent capability and budget limits." },
  { slice: "12H", title: "Production acceptance and hardening", state: "planned" as const, detail: "Benchmarks, rollback, operational acceptance and closure complete the Phase 12 release boundary." },
]);

export const PHASE12_NEXT_RUNTIME = PHASE12_RUNTIME_ROADMAP.find((item) => item.slice === "12C")!;

export function providerGateSummary(provider: ProviderRuntimeReadiness) {
  const passed = provider.gates.filter((gate) => gate.state === "passed").length;
  const pending = provider.gates.filter((gate) => gate.state === "pending").length;
  const locked = provider.gates.filter((gate) => gate.state === "locked").length;
  const nextGate = provider.gates.find((gate) => gate.state !== "passed") ?? null;
  return Object.freeze({
    passed,
    pending,
    locked,
    total: provider.gates.length,
    nextGate,
    accepted: passed === provider.gates.length,
  });
}

export function runtimeReadinessSummary() {
  const operational = PROVIDER_RUNTIME_READINESS.filter((provider) => provider.availability === "operational").length;
  const preparedExternal = PROVIDER_RUNTIME_READINESS.filter((provider) => provider.availability === "validation").length;
  const enabledExternal = PROVIDER_RUNTIME_READINESS.filter((provider) => provider.enabled && provider.availability !== "operational").length;
  const pendingContainment = PROVIDER_RUNTIME_READINESS.filter((provider) =>
    provider.gates.some((gate) => gate.id === "linux" && gate.state === "pending"),
  ).length;
  return Object.freeze({ operational, preparedExternal, enabledExternal, pendingContainment });
}
