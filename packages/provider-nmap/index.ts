import type {
  CapabilityProvider,
  ProviderExecutionContext,
  ProviderNormalizationContext,
  ProviderPolicyContext,
} from "../capability-registry/types";
import type { Observation, PrimitiveFacts } from "../security-planning";

export const NMAP_PROVIDER_ID = "nmap";
export const NMAP_PROVIDER_VERSION = "7.991";
export const NMAP_CAPABILITIES = Object.freeze([
  "network.port.discover.v1",
  "network.service.fingerprint.v1",
] as const);

export type NmapCapabilityId = (typeof NMAP_CAPABILITIES)[number];
export type NmapPortProfile = "top-100" | "top-1000" | "reviewed-explicit";
export type NmapTimingProfile = "polite" | "normal";

export interface NmapProviderRequest {
  capabilityId: NmapCapabilityId;
  targetNodeId: string;
  portProfile: NmapPortProfile;
  ports?: readonly number[];
  timingProfile: NmapTimingProfile;
}

export interface NmapPortRecord {
  targetNodeId: string;
  port: number;
  protocol: "tcp" | "udp";
  state: "open" | "closed" | "filtered" | "open|filtered";
  service?: string;
  product?: string;
  version?: string;
  evidenceRef: string;
  observedAt: string;
}

export interface NmapRawResult {
  capabilityId: NmapCapabilityId;
  actionId: string;
  targetNodeId: string;
  records: readonly NmapPortRecord[];
}

export interface NmapRunner {
  run(
    request: Readonly<NmapProviderRequest>,
    context: Readonly<ProviderExecutionContext>,
    signal: AbortSignal,
  ): Promise<NmapRawResult>;
}

const REQUEST_KEYS = new Set(["capabilityId", "targetNodeId", "portProfile", "ports", "timingProfile"]);
const PORT_PROFILES = new Set<NmapPortProfile>(["top-100", "top-1000", "reviewed-explicit"]);
const TIMING_PROFILES = new Set<NmapTimingProfile>(["polite", "normal"]);
const MAX_EXPLICIT_PORTS = 64;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueSortedPorts(value: unknown): readonly number[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length === 0 || value.length > MAX_EXPLICIT_PORTS) return null;
  if (value.some((port) => !Number.isInteger(port) || port < 1 || port > 65535)) return null;
  return Object.freeze([...new Set(value as number[])].sort((a, b) => a - b));
}

function normalizeRequest(request: unknown): Readonly<NmapProviderRequest> | null {
  if (!isRecord(request) || Object.keys(request).some((key) => !REQUEST_KEYS.has(key))) return null;
  if (!NMAP_CAPABILITIES.includes(request.capabilityId as NmapCapabilityId)) return null;
  if (typeof request.targetNodeId !== "string" || !request.targetNodeId.trim()) return null;
  if (!PORT_PROFILES.has(request.portProfile as NmapPortProfile)) return null;
  if (!TIMING_PROFILES.has(request.timingProfile as NmapTimingProfile)) return null;

  const portProfile = request.portProfile as NmapPortProfile;
  const ports = request.ports === undefined ? undefined : uniqueSortedPorts(request.ports);
  if (portProfile === "reviewed-explicit" && !ports) return null;
  if (portProfile !== "reviewed-explicit" && request.ports !== undefined) return null;

  return Object.freeze({
    capabilityId: request.capabilityId as NmapCapabilityId,
    targetNodeId: request.targetNodeId.trim(),
    portProfile,
    ...(ports ? { ports } : {}),
    timingProfile: request.timingProfile as NmapTimingProfile,
  });
}

function boundedText(value: string | undefined, maxLength = 160): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\r\n\0]/.test(normalized)) return undefined;
  return normalized;
}

function compactFacts(input: Record<string, string | number | undefined>): PrimitiveFacts {
  return Object.freeze(Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined))) as PrimitiveFacts;
}

function validateRawRecord(record: NmapPortRecord, expectedNodeId: string): void {
  if (record.targetNodeId !== expectedNodeId) throw new Error("NMAP_RESULT_TARGET_OUT_OF_SCOPE");
  if (!Number.isInteger(record.port) || record.port < 1 || record.port > 65535) throw new Error("NMAP_RESULT_PORT_INVALID");
  if (!record.evidenceRef.trim()) throw new Error("NMAP_RESULT_EVIDENCE_REQUIRED");
  if (!Number.isFinite(Date.parse(record.observedAt))) throw new Error("NMAP_RESULT_TIMESTAMP_INVALID");
}

export function createNmapProvider(runner: NmapRunner): CapabilityProvider<NmapProviderRequest, NmapRawResult> {
  return Object.freeze({
    providerId: NMAP_PROVIDER_ID,
    version: NMAP_PROVIDER_VERSION,
    capabilityIds: NMAP_CAPABILITIES,
    supportedModes: Object.freeze(["safe_active"] as const),
    validateRequest(request: NmapProviderRequest, context: ProviderPolicyContext) {
      const normalized = normalizeRequest(request);
      if (!normalized) return { ok: false as const, code: "NMAP_REQUEST_INVALID" };
      if (context.executionMode !== "safe_active") return { ok: false as const, code: "NMAP_MODE_UNSUPPORTED" };
      return { ok: true as const };
    },
    async execute(request: NmapProviderRequest, context: ProviderExecutionContext, signal: AbortSignal) {
      const normalized = normalizeRequest(request);
      if (!normalized) throw new Error("NMAP_REQUEST_INVALID");
      if (!context.targetNodeIds.includes(normalized.targetNodeId)) throw new Error("NMAP_TARGET_BINDING_INVALID");
      if (context.maxRequests < 1 || context.maxRuntimeMs < 1) throw new Error("NMAP_EXECUTION_BUDGET_INVALID");
      const raw = await runner.run(normalized, context, signal);
      if (raw.capabilityId !== normalized.capabilityId) throw new Error("NMAP_RESULT_CAPABILITY_MISMATCH");
      if (raw.actionId !== context.actionId) throw new Error("NMAP_RESULT_ACTION_MISMATCH");
      if (raw.targetNodeId !== normalized.targetNodeId) throw new Error("NMAP_RESULT_TARGET_MISMATCH");
      if (normalized.portProfile === "reviewed-explicit") {
        const approved = new Set(normalized.ports ?? []);
        if (raw.records.some((record) => !approved.has(record.port))) throw new Error("NMAP_RESULT_PORT_OUTSIDE_PROFILE");
      }
      return raw;
    },
    async normalize(raw: NmapRawResult, context: ProviderNormalizationContext) {
      if (!NMAP_CAPABILITIES.includes(raw.capabilityId)) throw new Error("NMAP_RESULT_CAPABILITY_INVALID");
      if (raw.actionId !== context.actionId) throw new Error("NMAP_RESULT_ACTION_MISMATCH");
      if (!raw.targetNodeId.trim()) throw new Error("NMAP_RESULT_TARGET_REQUIRED");
      const observations = raw.records.map((record: NmapPortRecord): Observation => {
        validateRawRecord(record, raw.targetNodeId);
        const fingerprint = [record.targetNodeId, record.protocol, record.port].map(encodeURIComponent).join(":");
        return Object.freeze({
          observationId: `phase11:nmap:${encodeURIComponent(context.actionId)}:${fingerprint}`,
          runId: context.runId,
          providerId: NMAP_PROVIDER_ID,
          providerVersion: NMAP_PROVIDER_VERSION,
          capabilityId: raw.capabilityId,
          assetNodeIds: Object.freeze([record.targetNodeId]),
          evidenceRefs: Object.freeze([record.evidenceRef.trim()]),
          facts: compactFacts({
            port: record.port,
            protocol: record.protocol,
            state: record.state,
            service: boundedText(record.service),
            product: boundedText(record.product),
            version: boundedText(record.version),
          }),
          observedAt: new Date(record.observedAt).toISOString(),
          confidence: raw.capabilityId === "network.service.fingerprint.v1" ? 0.85 : 0.95,
          authorizationSnapshotRef: context.authorizationSnapshotRef,
          executionMode: "safe_active",
        });
      });
      return Object.freeze(observations.sort((a: Observation, b: Observation) => a.observationId.localeCompare(b.observationId)));
    },
    async cleanup() {
      return { ok: true as const };
    },
  });
}
