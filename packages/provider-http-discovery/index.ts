import type {
  CapabilityProvider,
  ProviderExecutionContext,
  ProviderNormalizationContext,
  ProviderPolicyContext,
} from "../capability-registry/types";
import type { Observation, PrimitiveFacts } from "../security-planning";

export const HTTP_DISCOVERY_PROVIDER_ID = "scopeforge.http-discovery";
export const HTTP_DISCOVERY_PROVIDER_VERSION = "1.0.0";
export const HTTP_DISCOVERY_CAPABILITIES = Object.freeze([
  "web.http.probe.v1",
  "web.route.discover.v1",
] as const);

export type HttpDiscoveryCapabilityId = (typeof HTTP_DISCOVERY_CAPABILITIES)[number];
export type HttpDiscoveryProfile = "root-only" | "well-known-safe";
export type HttpMethodProfile = "HEAD_THEN_GET" | "GET_ONLY";

export interface HttpDiscoveryRequest {
  capabilityId: HttpDiscoveryCapabilityId;
  targetNodeId: string;
  discoveryProfile: HttpDiscoveryProfile;
  methodProfile: HttpMethodProfile;
  followSameOriginRedirects: boolean;
}

export type HttpDiscoveryRouteKind = "root" | "security-txt" | "robots" | "sitemap";

export interface HttpDiscoveryRecord {
  targetNodeId: string;
  routeKind: HttpDiscoveryRouteKind;
  status: number;
  contentType?: string;
  redirectTargetNodeId?: string;
  evidenceRef: string;
  observedAt: string;
}

export interface HttpDiscoveryRawResult {
  capabilityId: HttpDiscoveryCapabilityId;
  actionId: string;
  targetNodeId: string;
  discoveryProfile: HttpDiscoveryProfile;
  records: readonly HttpDiscoveryRecord[];
}

export interface HttpDiscoveryRunner {
  run(
    request: Readonly<HttpDiscoveryRequest>,
    context: Readonly<ProviderExecutionContext>,
    signal: AbortSignal,
  ): Promise<HttpDiscoveryRawResult>;
}

const REQUEST_KEYS = new Set([
  "capabilityId",
  "targetNodeId",
  "discoveryProfile",
  "methodProfile",
  "followSameOriginRedirects",
]);
const PROFILES = new Set<HttpDiscoveryProfile>(["root-only", "well-known-safe"]);
const METHODS = new Set<HttpMethodProfile>(["HEAD_THEN_GET", "GET_ONLY"]);
const ROUTE_KINDS = new Set<HttpDiscoveryRouteKind>(["root", "security-txt", "robots", "sitemap"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRequest(request: unknown): Readonly<HttpDiscoveryRequest> | null {
  if (!isRecord(request) || Object.keys(request).some((key) => !REQUEST_KEYS.has(key))) return null;
  if (!HTTP_DISCOVERY_CAPABILITIES.includes(request.capabilityId as HttpDiscoveryCapabilityId)) return null;
  if (typeof request.targetNodeId !== "string" || !request.targetNodeId.trim()) return null;
  if (!PROFILES.has(request.discoveryProfile as HttpDiscoveryProfile)) return null;
  if (!METHODS.has(request.methodProfile as HttpMethodProfile)) return null;
  if (typeof request.followSameOriginRedirects !== "boolean") return null;
  return Object.freeze({
    capabilityId: request.capabilityId as HttpDiscoveryCapabilityId,
    targetNodeId: request.targetNodeId.trim(),
    discoveryProfile: request.discoveryProfile as HttpDiscoveryProfile,
    methodProfile: request.methodProfile as HttpMethodProfile,
    followSameOriginRedirects: request.followSameOriginRedirects,
  });
}

function boundedText(value: string | undefined, maxLength = 160): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\r\n\0]/.test(normalized)) return undefined;
  return normalized;
}

function compactFacts(input: Record<string, string | number | boolean | undefined>): PrimitiveFacts {
  return Object.freeze(Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined))) as PrimitiveFacts;
}

export function createHttpDiscoveryProvider(
  runner: HttpDiscoveryRunner,
): CapabilityProvider<HttpDiscoveryRequest, HttpDiscoveryRawResult> {
  return Object.freeze({
    providerId: HTTP_DISCOVERY_PROVIDER_ID,
    version: HTTP_DISCOVERY_PROVIDER_VERSION,
    capabilityIds: HTTP_DISCOVERY_CAPABILITIES,
    supportedModes: Object.freeze(["safe_active"] as const),
    validateRequest(request: HttpDiscoveryRequest, context: ProviderPolicyContext) {
      const normalized = normalizeRequest(request);
      if (!normalized) return { ok: false as const, code: "HTTP_DISCOVERY_REQUEST_INVALID" };
      if (context.executionMode !== "safe_active") return { ok: false as const, code: "HTTP_DISCOVERY_MODE_UNSUPPORTED" };
      return { ok: true as const };
    },
    async execute(request: HttpDiscoveryRequest, context: ProviderExecutionContext, signal: AbortSignal) {
      const normalized = normalizeRequest(request);
      if (!normalized) throw new Error("HTTP_DISCOVERY_REQUEST_INVALID");
      if (!context.targetNodeIds.includes(normalized.targetNodeId)) throw new Error("HTTP_DISCOVERY_TARGET_BINDING_INVALID");
      if (context.maxRequests < 1 || context.maxRuntimeMs < 1) throw new Error("HTTP_DISCOVERY_EXECUTION_BUDGET_INVALID");
      const raw = await runner.run(normalized, context, signal);
      if (raw.capabilityId !== normalized.capabilityId) throw new Error("HTTP_DISCOVERY_RESULT_CAPABILITY_MISMATCH");
      if (raw.actionId !== context.actionId) throw new Error("HTTP_DISCOVERY_RESULT_ACTION_MISMATCH");
      if (raw.targetNodeId !== normalized.targetNodeId) throw new Error("HTTP_DISCOVERY_RESULT_TARGET_MISMATCH");
      if (raw.discoveryProfile !== normalized.discoveryProfile) throw new Error("HTTP_DISCOVERY_RESULT_PROFILE_MISMATCH");
      return raw;
    },
    async normalize(raw: HttpDiscoveryRawResult, context: ProviderNormalizationContext) {
      if (!HTTP_DISCOVERY_CAPABILITIES.includes(raw.capabilityId)) throw new Error("HTTP_DISCOVERY_RESULT_CAPABILITY_INVALID");
      if (raw.actionId !== context.actionId) throw new Error("HTTP_DISCOVERY_RESULT_ACTION_MISMATCH");
      if (!raw.targetNodeId.trim()) throw new Error("HTTP_DISCOVERY_RESULT_TARGET_REQUIRED");
      const observations = raw.records.map((record: HttpDiscoveryRecord): Observation => {
        if (record.targetNodeId !== raw.targetNodeId) throw new Error("HTTP_DISCOVERY_RESULT_TARGET_OUT_OF_SCOPE");
        if (!ROUTE_KINDS.has(record.routeKind)) throw new Error("HTTP_DISCOVERY_RESULT_ROUTE_KIND_INVALID");
        if (raw.discoveryProfile === "root-only" && record.routeKind !== "root") throw new Error("HTTP_DISCOVERY_RESULT_ROUTE_OUTSIDE_PROFILE");
        if (raw.capabilityId === "web.http.probe.v1" && record.routeKind !== "root") throw new Error("HTTP_DISCOVERY_RESULT_ROUTE_OUTSIDE_CAPABILITY");
        if (!Number.isInteger(record.status) || record.status < 100 || record.status > 599) throw new Error("HTTP_DISCOVERY_RESULT_STATUS_INVALID");
        if (!record.evidenceRef.trim()) throw new Error("HTTP_DISCOVERY_RESULT_EVIDENCE_REQUIRED");
        if (!Number.isFinite(Date.parse(record.observedAt))) throw new Error("HTTP_DISCOVERY_RESULT_TIMESTAMP_INVALID");
        return Object.freeze({
          observationId: [
            "phase11",
            "http-discovery",
            encodeURIComponent(context.actionId),
            encodeURIComponent(record.targetNodeId),
            record.routeKind,
          ].join(":"),
          runId: context.runId,
          providerId: HTTP_DISCOVERY_PROVIDER_ID,
          providerVersion: HTTP_DISCOVERY_PROVIDER_VERSION,
          capabilityId: raw.capabilityId,
          assetNodeIds: Object.freeze([record.targetNodeId]),
          evidenceRefs: Object.freeze([record.evidenceRef.trim()]),
          facts: compactFacts({
            routeKind: record.routeKind,
            status: record.status,
            contentType: boundedText(record.contentType),
            redirectTargetNodeId: boundedText(record.redirectTargetNodeId),
            discoveryProfile: raw.discoveryProfile,
          }),
          observedAt: new Date(record.observedAt).toISOString(),
          confidence: 0.95,
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
