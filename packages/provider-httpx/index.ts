import type {
  CapabilityProvider,
  ProviderExecutionContext,
  ProviderNormalizationContext,
  ProviderPolicyContext,
} from "../capability-registry/types";
import { phase11StableId, type Observation, type PrimitiveFacts } from "../security-planning";

export const HTTPX_PROVIDER_ID = "projectdiscovery.httpx";
export const HTTPX_PROVIDER_VERSION = "1.12.0";
export const HTTPX_CAPABILITY = "web.http.probe.v1" as const;

export type HttpxScheme = "http" | "https";
export type HttpxProbe =
  | "status"
  | "title"
  | "server"
  | "content_type"
  | "tls"
  | "tech";

export interface HttpxProviderRequest {
  capabilityId: typeof HTTPX_CAPABILITY;
  targetNodeId: string;
  scheme: HttpxScheme;
  port: number;
  maxRedirects: number;
  probes: readonly HttpxProbe[];
}

export interface HttpxProbeRecord {
  targetNodeId: string;
  status: number;
  redirectCount: number;
  contentType?: string;
  title?: string;
  server?: string;
  tlsProtocol?: string;
  technologies?: readonly string[];
  evidenceRef: string;
  observedAt: string;
}

export interface HttpxRawResult {
  capabilityId: typeof HTTPX_CAPABILITY;
  actionId: string;
  targetNodeId: string;
  scheme: HttpxScheme;
  port: number;
  maxRedirects: number;
  record?: HttpxProbeRecord;
}

export interface HttpxRunner {
  run(
    request: Readonly<HttpxProviderRequest>,
    context: Readonly<ProviderExecutionContext>,
    signal: AbortSignal,
  ): Promise<HttpxRawResult>;
}

const REQUEST_KEYS = new Set([
  "capabilityId",
  "targetNodeId",
  "scheme",
  "port",
  "maxRedirects",
  "probes",
]);
const SCHEMES = new Set<HttpxScheme>(["http", "https"]);
const PROBES = new Set<HttpxProbe>([
  "status",
  "title",
  "server",
  "content_type",
  "tls",
  "tech",
]);
const MAX_TECHNOLOGIES = 32;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeProbes(value: unknown): readonly HttpxProbe[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > PROBES.size) return null;
  if (value.some((probe) => typeof probe !== "string" || !PROBES.has(probe as HttpxProbe))) return null;
  const normalized = [...new Set(value as HttpxProbe[])].sort();
  if (normalized.length !== value.length) return null;
  return Object.freeze(normalized);
}

function normalizeRequest(request: unknown): Readonly<HttpxProviderRequest> | null {
  if (!isRecord(request) || Object.keys(request).some((key) => !REQUEST_KEYS.has(key))) return null;
  if (request.capabilityId !== HTTPX_CAPABILITY) return null;
  if (typeof request.targetNodeId !== "string" || !request.targetNodeId.trim()) return null;
  if (!SCHEMES.has(request.scheme as HttpxScheme)) return null;
  if (!Number.isInteger(request.port) || (request.port as number) < 1 || (request.port as number) > 65535) return null;
  if (!Number.isInteger(request.maxRedirects) || (request.maxRedirects as number) < 0 || (request.maxRedirects as number) > 3) return null;
  const probes = normalizeProbes(request.probes);
  if (!probes) return null;
  return Object.freeze({
    capabilityId: HTTPX_CAPABILITY,
    targetNodeId: request.targetNodeId.trim(),
    scheme: request.scheme as HttpxScheme,
    port: request.port as number,
    maxRedirects: request.maxRedirects as number,
    probes,
  });
}

function boundedText(value: string | undefined, maxLength = 160): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\r\n\0]/.test(normalized)) return undefined;
  return normalized;
}

function boundedTechnologies(value: readonly string[] | undefined): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > MAX_TECHNOLOGIES) throw new Error("HTTPX_RESULT_TECHNOLOGY_LIMIT_EXCEEDED");
  const normalized = [...new Set(value.map((item) => boundedText(item, 80)).filter((item): item is string => Boolean(item)))].sort();
  if (normalized.length !== value.length) throw new Error("HTTPX_RESULT_TECHNOLOGY_INVALID");
  return Object.freeze(normalized);
}

function compactFacts(input: Record<string, string | number | undefined>): PrimitiveFacts {
  return Object.freeze(Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined))) as PrimitiveFacts;
}

function validateRecord(record: HttpxProbeRecord, expectedNodeId: string, maxRedirects: number): void {
  if (record.targetNodeId !== expectedNodeId) throw new Error("HTTPX_RESULT_TARGET_OUT_OF_SCOPE");
  if (!Number.isInteger(record.status) || record.status < 100 || record.status > 599) throw new Error("HTTPX_RESULT_STATUS_INVALID");
  if (!Number.isInteger(record.redirectCount) || record.redirectCount < 0 || record.redirectCount > maxRedirects) {
    throw new Error("HTTPX_RESULT_REDIRECT_COUNT_INVALID");
  }
  if (!record.evidenceRef.trim()) throw new Error("HTTPX_RESULT_EVIDENCE_REQUIRED");
  if (!Number.isFinite(Date.parse(record.observedAt))) throw new Error("HTTPX_RESULT_TIMESTAMP_INVALID");
  boundedTechnologies(record.technologies);
}

export function createHttpxProvider(
  runner: HttpxRunner,
): CapabilityProvider<HttpxProviderRequest, HttpxRawResult> {
  return Object.freeze({
    providerId: HTTPX_PROVIDER_ID,
    version: HTTPX_PROVIDER_VERSION,
    capabilityIds: Object.freeze([HTTPX_CAPABILITY]),
    supportedModes: Object.freeze(["safe_active"] as const),

    validateRequest(request: HttpxProviderRequest, context: ProviderPolicyContext) {
      const normalized = normalizeRequest(request);
      if (!normalized) return { ok: false as const, code: "HTTPX_REQUEST_INVALID" };
      if (context.executionMode !== "safe_active") return { ok: false as const, code: "HTTPX_MODE_UNSUPPORTED" };
      return { ok: true as const };
    },

    async execute(request: HttpxProviderRequest, context: ProviderExecutionContext, signal: AbortSignal) {
      const normalized = normalizeRequest(request);
      if (!normalized) throw new Error("HTTPX_REQUEST_INVALID");
      if (!context.targetNodeIds.includes(normalized.targetNodeId)) throw new Error("HTTPX_TARGET_BINDING_INVALID");
      if (context.maxRequests < 1 || context.maxRuntimeMs < 1) throw new Error("HTTPX_EXECUTION_BUDGET_INVALID");

      const raw = await runner.run(normalized, context, signal);
      if (raw.capabilityId !== HTTPX_CAPABILITY) throw new Error("HTTPX_RESULT_CAPABILITY_MISMATCH");
      if (raw.actionId !== context.actionId) throw new Error("HTTPX_RESULT_ACTION_MISMATCH");
      if (raw.targetNodeId !== normalized.targetNodeId) throw new Error("HTTPX_RESULT_TARGET_MISMATCH");
      if (raw.scheme !== normalized.scheme || raw.port !== normalized.port || raw.maxRedirects !== normalized.maxRedirects) {
        throw new Error("HTTPX_RESULT_PROFILE_MISMATCH");
      }
      if (raw.record) validateRecord(raw.record, normalized.targetNodeId, normalized.maxRedirects);
      return raw;
    },

    async normalize(raw: HttpxRawResult, context: ProviderNormalizationContext) {
      if (raw.capabilityId !== HTTPX_CAPABILITY) throw new Error("HTTPX_RESULT_CAPABILITY_INVALID");
      if (raw.actionId !== context.actionId) throw new Error("HTTPX_RESULT_ACTION_MISMATCH");
      if (!raw.targetNodeId.trim()) throw new Error("HTTPX_RESULT_TARGET_REQUIRED");
      if (!SCHEMES.has(raw.scheme)) throw new Error("HTTPX_RESULT_SCHEME_INVALID");
      if (!Number.isInteger(raw.port) || raw.port < 1 || raw.port > 65535) throw new Error("HTTPX_RESULT_PORT_INVALID");
      if (!Number.isInteger(raw.maxRedirects) || raw.maxRedirects < 0 || raw.maxRedirects > 3) throw new Error("HTTPX_RESULT_REDIRECT_PROFILE_INVALID");
      if (!raw.record) return Object.freeze([]);

      validateRecord(raw.record, raw.targetNodeId, raw.maxRedirects);
      const technologies = boundedTechnologies(raw.record.technologies);

      const observation: Observation = Object.freeze({
        observationId: phase11StableId("phase12-obs-httpx", [
          context.actionId,
          raw.targetNodeId,
          raw.scheme,
          String(raw.port),
          String(raw.record.status),
          raw.record.evidenceRef,
        ]),
        runId: context.runId,
        providerId: HTTPX_PROVIDER_ID,
        providerVersion: HTTPX_PROVIDER_VERSION,
        capabilityId: HTTPX_CAPABILITY,
        assetNodeIds: Object.freeze([raw.targetNodeId]),
        evidenceRefs: Object.freeze([raw.record.evidenceRef.trim()]),
        facts: compactFacts({
          scheme: raw.scheme,
          port: raw.port,
          status: raw.record.status,
          redirectCount: raw.record.redirectCount,
          contentType: boundedText(raw.record.contentType),
          title: boundedText(raw.record.title),
          server: boundedText(raw.record.server),
          tlsProtocol: boundedText(raw.record.tlsProtocol),
          technologies: technologies?.join(","),
        }),
        observedAt: new Date(raw.record.observedAt).toISOString(),
        confidence: 0.95,
        authorizationSnapshotRef: context.authorizationSnapshotRef,
        executionMode: "safe_active",
      });

      return Object.freeze([observation]);
    },

    async cleanup() {
      return { ok: true as const };
    },
  });
}
