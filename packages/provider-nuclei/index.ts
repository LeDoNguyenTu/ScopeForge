import type {
  CapabilityProvider,
  ProviderExecutionContext,
  ProviderNormalizationContext,
  ProviderPolicyContext,
} from "../capability-registry/types";
import { phase11StableId, type Observation, type PrimitiveFacts } from "../security-planning";

export const NUCLEI_PROVIDER_ID = "nuclei";
export const NUCLEI_PROVIDER_VERSION = "3.11.1";
export const NUCLEI_CAPABILITY = "web.template.validate.v1" as const;

export type NucleiTemplateProfile =
  | "baseline-http"
  | "misconfiguration-reviewed"
  | "known-cve-reviewed";
export type NucleiSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface NucleiProviderRequest {
  capabilityId: typeof NUCLEI_CAPABILITY;
  targetNodeId: string;
  templateProfile: NucleiTemplateProfile;
  minimumSeverity: NucleiSeverity;
}

export interface NucleiMatchRecord {
  targetNodeId: string;
  templateId: string;
  severity: NucleiSeverity;
  matcherName?: string;
  evidenceRef: string;
  observedAt: string;
}

export interface NucleiRawResult {
  capabilityId: typeof NUCLEI_CAPABILITY;
  actionId: string;
  targetNodeId: string;
  templateProfile: NucleiTemplateProfile;
  minimumSeverity: NucleiSeverity;
  matches: readonly NucleiMatchRecord[];
}

export interface NucleiRunnerRequest extends NucleiProviderRequest {
  approvedTemplateIds: readonly string[];
}

export interface NucleiRunner {
  run(
    request: Readonly<NucleiRunnerRequest>,
    context: Readonly<ProviderExecutionContext>,
    signal: AbortSignal,
  ): Promise<NucleiRawResult>;
}

export interface NucleiProviderConfig {
  profiles: Readonly<Record<NucleiTemplateProfile, readonly string[]>>;
}

const REQUEST_KEYS = new Set(["capabilityId", "targetNodeId", "templateProfile", "minimumSeverity"]);
const PROFILES = new Set<NucleiTemplateProfile>([
  "baseline-http",
  "misconfiguration-reviewed",
  "known-cve-reviewed",
]);
const SEVERITIES = new Set<NucleiSeverity>(["info", "low", "medium", "high", "critical"]);
const TEMPLATE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const MAX_NUCLEI_MATCHES = 4096;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.map((value) => value.trim()).filter(Boolean))].sort());
}

function normalizeRequest(request: unknown): Readonly<NucleiProviderRequest> | null {
  if (!isRecord(request) || Object.keys(request).some((key) => !REQUEST_KEYS.has(key))) return null;
  if (request.capabilityId !== NUCLEI_CAPABILITY) return null;
  if (typeof request.targetNodeId !== "string" || !request.targetNodeId.trim()) return null;
  if (!PROFILES.has(request.templateProfile as NucleiTemplateProfile)) return null;
  if (!SEVERITIES.has(request.minimumSeverity as NucleiSeverity)) return null;
  return Object.freeze({
    capabilityId: NUCLEI_CAPABILITY,
    targetNodeId: request.targetNodeId.trim(),
    templateProfile: request.templateProfile as NucleiTemplateProfile,
    minimumSeverity: request.minimumSeverity as NucleiSeverity,
  });
}

function validateConfig(config: NucleiProviderConfig): Readonly<NucleiProviderConfig> {
  const profiles = {} as Record<NucleiTemplateProfile, readonly string[]>;
  for (const profile of PROFILES) {
    const inputTemplates = config.profiles[profile] ?? [];
    if (inputTemplates.some((templateId) =>
      typeof templateId !== "string"
      || templateId !== templateId.trim()
      || !TEMPLATE_ID_PATTERN.test(templateId)
    )) {
      throw new Error(`NUCLEI_TEMPLATE_ID_INVALID:${profile}`);
    }
    const templates = uniqueSorted(inputTemplates);
    profiles[profile] = templates;
  }
  return Object.freeze({ profiles: Object.freeze(profiles) });
}

function boundedText(value: string | undefined, maxLength = 160): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\r\n\0]/.test(normalized)) return undefined;
  return normalized;
}

function compactFacts(input: Record<string, string | undefined>): PrimitiveFacts {
  return Object.freeze(Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined))) as PrimitiveFacts;
}

export function createNucleiProvider(
  runner: NucleiRunner,
  inputConfig: NucleiProviderConfig,
): CapabilityProvider<NucleiProviderRequest, NucleiRawResult> {
  const config = validateConfig(inputConfig);
  const severityRank: Readonly<Record<NucleiSeverity, number>> = Object.freeze({ info: 0, low: 1, medium: 2, high: 3, critical: 4 });

  return Object.freeze({
    providerId: NUCLEI_PROVIDER_ID,
    version: NUCLEI_PROVIDER_VERSION,
    capabilityIds: Object.freeze([NUCLEI_CAPABILITY]),
    supportedModes: Object.freeze(["validation"] as const),
    validateRequest(request: NucleiProviderRequest, context: ProviderPolicyContext) {
      const normalized = normalizeRequest(request);
      if (!normalized) return { ok: false as const, code: "NUCLEI_REQUEST_INVALID" };
      if (context.executionMode !== "validation") return { ok: false as const, code: "NUCLEI_MODE_UNSUPPORTED" };
      if (!config.profiles[normalized.templateProfile]?.length) return { ok: false as const, code: "NUCLEI_PROFILE_DISABLED" };
      return { ok: true as const };
    },
    async execute(request: NucleiProviderRequest, context: ProviderExecutionContext, signal: AbortSignal) {
      const normalized = normalizeRequest(request);
      if (!normalized) throw new Error("NUCLEI_REQUEST_INVALID");
      if (!context.targetNodeIds.includes(normalized.targetNodeId)) throw new Error("NUCLEI_TARGET_BINDING_INVALID");
      if (context.maxRequests < 1 || context.maxRuntimeMs < 1) throw new Error("NUCLEI_EXECUTION_BUDGET_INVALID");
      const approvedTemplateIds = config.profiles[normalized.templateProfile];
      const raw = await runner.run(Object.freeze({ ...normalized, approvedTemplateIds }), context, signal);
      if (raw.capabilityId !== NUCLEI_CAPABILITY) throw new Error("NUCLEI_RESULT_CAPABILITY_MISMATCH");
      if (raw.actionId !== context.actionId) throw new Error("NUCLEI_RESULT_ACTION_MISMATCH");
      if (raw.targetNodeId !== normalized.targetNodeId) throw new Error("NUCLEI_RESULT_TARGET_MISMATCH");
      if (raw.templateProfile !== normalized.templateProfile) throw new Error("NUCLEI_RESULT_PROFILE_MISMATCH");
      if (raw.minimumSeverity !== normalized.minimumSeverity) throw new Error("NUCLEI_RESULT_SEVERITY_FLOOR_MISMATCH");
      if (!Array.isArray(raw.matches) || raw.matches.length > MAX_NUCLEI_MATCHES) throw new Error("NUCLEI_RESULT_MATCH_LIMIT_EXCEEDED");
      return raw;
    },
    async normalize(raw: NucleiRawResult, context: ProviderNormalizationContext) {
      if (raw.capabilityId !== NUCLEI_CAPABILITY) throw new Error("NUCLEI_RESULT_CAPABILITY_INVALID");
      if (raw.actionId !== context.actionId) throw new Error("NUCLEI_RESULT_ACTION_MISMATCH");
      if (!raw.targetNodeId.trim()) throw new Error("NUCLEI_RESULT_TARGET_REQUIRED");
      if (!PROFILES.has(raw.templateProfile)) throw new Error("NUCLEI_RESULT_PROFILE_INVALID");
      if (!SEVERITIES.has(raw.minimumSeverity)) throw new Error("NUCLEI_RESULT_SEVERITY_FLOOR_INVALID");
      if (!Array.isArray(raw.matches) || raw.matches.length > MAX_NUCLEI_MATCHES) throw new Error("NUCLEI_RESULT_MATCH_LIMIT_EXCEEDED");
      const approvedForProfile = new Set(config.profiles[raw.templateProfile] ?? []);
      const observations = raw.matches.map((match: NucleiMatchRecord): Observation => {
        if (match.targetNodeId !== raw.targetNodeId) throw new Error("NUCLEI_RESULT_TARGET_OUT_OF_SCOPE");
        if (!approvedForProfile.has(match.templateId)) throw new Error(`NUCLEI_TEMPLATE_NOT_APPROVED:${match.templateId}`);
        if (!SEVERITIES.has(match.severity)) throw new Error("NUCLEI_RESULT_SEVERITY_INVALID");
        if (severityRank[match.severity] < severityRank[raw.minimumSeverity]) throw new Error("NUCLEI_RESULT_BELOW_SEVERITY_FLOOR");
        if (!match.evidenceRef.trim()) throw new Error("NUCLEI_RESULT_EVIDENCE_REQUIRED");
        if (!Number.isFinite(Date.parse(match.observedAt))) throw new Error("NUCLEI_RESULT_TIMESTAMP_INVALID");
        return Object.freeze({
          observationId: phase11StableId("phase11-obs-nuclei", [
            context.actionId,
            match.targetNodeId,
            match.templateId,
            match.severity,
            match.evidenceRef,
          ]),
          runId: context.runId,
          providerId: NUCLEI_PROVIDER_ID,
          providerVersion: NUCLEI_PROVIDER_VERSION,
          capabilityId: NUCLEI_CAPABILITY,
          assetNodeIds: Object.freeze([match.targetNodeId]),
          evidenceRefs: Object.freeze([match.evidenceRef.trim()]),
          facts: compactFacts({
            templateId: match.templateId,
            severity: match.severity,
            matcherName: boundedText(match.matcherName),
            templateProfile: raw.templateProfile,
          }),
          observedAt: new Date(match.observedAt).toISOString(),
          confidence: 0.9,
          authorizationSnapshotRef: context.authorizationSnapshotRef,
          executionMode: "validation",
        });
      });
      return Object.freeze(observations.sort((a: Observation, b: Observation) => a.observationId.localeCompare(b.observationId)));
    },
    async cleanup() {
      return { ok: true as const };
    },
  });
}
