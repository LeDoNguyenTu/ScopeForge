import { createHash } from "node:crypto";
import type {
  CapabilityProvider,
  CleanupContext,
  CleanupResult,
  ProviderExecutionContext,
  ProviderNormalizationContext,
  ProviderPolicyContext,
} from "../capability-registry/types";
import { phase11StableId, type Observation, type PrimitiveFacts } from "../security-planning";
import {
  PROOF_VALIDATION_CAPABILITY_ID,
  PROOF_VALIDATION_PROFILE,
} from "../pentest-policy/proof-validation";

export interface ReflectionProofRequest {
  capabilityId: typeof PROOF_VALIDATION_CAPABILITY_ID;
  targetNodeId: string;
  proofProfile: typeof PROOF_VALIDATION_PROFILE;
}

export interface ReflectionProofRawResult {
  capabilityId: typeof PROOF_VALIDATION_CAPABILITY_ID;
  actionId: string;
  targetNodeId: string;
  status: number;
  reflected: boolean;
  evidenceRef: string;
  observedAt: string;
}

export interface ReflectionProofTransport {
  request(input: {
    url: string;
    method: "GET";
    maxBodyBytes: number;
    signal: AbortSignal;
  }): Promise<{ status: number; location?: string; body: string }>;
}

export interface ReflectionProofRunner {
  run(
    request: Readonly<ReflectionProofRequest>,
    context: Readonly<ProviderExecutionContext>,
    signal: AbortSignal,
  ): Promise<ReflectionProofRawResult>;
  cleanup(context: CleanupContext): Promise<CleanupResult>;
}

const MAX_BODY_BYTES = 4 * 1024;
const REQUEST_KEYS = new Set(["capabilityId", "targetNodeId", "proofProfile"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRequest(value: unknown): Readonly<ReflectionProofRequest> | null {
  if (!isRecord(value) || Object.keys(value).some((key) => !REQUEST_KEYS.has(key))) return null;
  if (value.capabilityId !== PROOF_VALIDATION_CAPABILITY_ID
      || value.proofProfile !== PROOF_VALIDATION_PROFILE
      || typeof value.targetNodeId !== "string"
      || !value.targetNodeId.trim()) return null;
  return Object.freeze({
    capabilityId: PROOF_VALIDATION_CAPABILITY_ID,
    targetNodeId: value.targetNodeId.trim(),
    proofProfile: PROOF_VALIDATION_PROFILE,
  });
}

function canonicalOrigin(locator: string): URL {
  const target = new URL(locator);
  const loopbackLab = target.protocol === "http:" && target.hostname === "127.0.0.1";
  if ((target.protocol !== "https:" && !loopbackLab)
      || target.username || target.password || target.search || target.hash) {
    throw new Error("PROOF_VALIDATION_TARGET_INVALID");
  }
  return target;
}

function proofMarker(context: Readonly<ProviderExecutionContext>): string {
  return createHash("sha256")
    .update(`${context.actionId}\0${context.authorizationId}`, "utf8")
    .digest("hex");
}

function facts(input: Record<string, string | number | boolean>): PrimitiveFacts {
  return Object.freeze({ ...input });
}

export function createBoundedReflectionProofRunner(input: {
  resolveTarget(targetNodeId: string): Promise<string>;
  transport: ReflectionProofTransport;
  now?: () => Date;
}): ReflectionProofRunner {
  return Object.freeze({
    async run(request, context, signal) {
      if (context.maxRequests !== 1) throw new Error("PROOF_VALIDATION_REQUEST_BUDGET_INVALID");
      const root = canonicalOrigin(await input.resolveTarget(request.targetNodeId));
      const marker = proofMarker(context);
      const target = new URL("/proof/reflection", root.origin);
      target.searchParams.set("marker", marker);
      const response = await input.transport.request({
        url: target.toString(),
        method: "GET",
        maxBodyBytes: MAX_BODY_BYTES,
        signal,
      });
      if (response.location) throw new Error("PROOF_VALIDATION_REDIRECT_NOT_ALLOWED");
      if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599) {
        throw new Error("PROOF_VALIDATION_STATUS_INVALID");
      }
      if (Buffer.byteLength(response.body, "utf8") > MAX_BODY_BYTES) {
        throw new Error("PROOF_VALIDATION_BODY_LIMIT");
      }
      let reflected = false;
      try {
        const decoded = JSON.parse(response.body) as unknown;
        reflected = isRecord(decoded) && decoded.proof === marker && Object.keys(decoded).length === 1;
      } catch {
        reflected = false;
      }
      const observedAt = (input.now ?? (() => new Date()))().toISOString();
      return Object.freeze({
        capabilityId: PROOF_VALIDATION_CAPABILITY_ID,
        actionId: context.actionId,
        targetNodeId: request.targetNodeId,
        status: response.status,
        reflected,
        evidenceRef: phase11StableId("phase11-proof-evidence", [
          context.actionId, request.targetNodeId, String(response.status), String(reflected),
        ]),
        observedAt,
      });
    },
    async cleanup() {
      return { ok: true as const };
    },
  });
}

export function createReflectionProofProvider(
  runner: ReflectionProofRunner,
): CapabilityProvider<ReflectionProofRequest, ReflectionProofRawResult> {
  return Object.freeze({
    providerId: "scopeforge.proof-validation",
    version: "1.0.0",
    capabilityIds: Object.freeze([PROOF_VALIDATION_CAPABILITY_ID]),
    supportedModes: Object.freeze(["validation"] as const),
    validateRequest(request: ReflectionProofRequest, context: ProviderPolicyContext) {
      if (!normalizeRequest(request)) return { ok: false as const, code: "PROOF_VALIDATION_REQUEST_INVALID" };
      if (context.executionMode !== "validation") return { ok: false as const, code: "PROOF_VALIDATION_MODE_INVALID" };
      return { ok: true as const };
    },
    async execute(request: ReflectionProofRequest, context: ProviderExecutionContext, signal: AbortSignal) {
      const normalized = normalizeRequest(request);
      if (!normalized) throw new Error("PROOF_VALIDATION_REQUEST_INVALID");
      if (context.maxRequests !== 1 || !context.targetNodeIds.includes(normalized.targetNodeId)) {
        throw new Error("PROOF_VALIDATION_AUTHORIZATION_INVALID");
      }
      const raw = await runner.run(normalized, context, signal);
      if (raw.actionId !== context.actionId || raw.targetNodeId !== normalized.targetNodeId) {
        throw new Error("PROOF_VALIDATION_RESULT_BINDING_INVALID");
      }
      return raw;
    },
    async normalize(raw: ReflectionProofRawResult, context: ProviderNormalizationContext) {
      if (raw.capabilityId !== PROOF_VALIDATION_CAPABILITY_ID
          || raw.actionId !== context.actionId
          || !raw.targetNodeId.trim()
          || !Number.isInteger(raw.status)
          || raw.status < 100
          || raw.status > 599
          || !raw.evidenceRef.trim()
          || !Number.isFinite(Date.parse(raw.observedAt))) {
        throw new Error("PROOF_VALIDATION_RESULT_INVALID");
      }
      const observation: Observation = Object.freeze({
        observationId: phase11StableId("phase11-obs-proof", [
          context.actionId, raw.targetNodeId, String(raw.status), String(raw.reflected),
        ]),
        runId: context.runId,
        providerId: "scopeforge.proof-validation",
        providerVersion: "1.0.0",
        capabilityId: PROOF_VALIDATION_CAPABILITY_ID,
        assetNodeIds: Object.freeze([raw.targetNodeId]),
        evidenceRefs: Object.freeze([raw.evidenceRef]),
        facts: facts({
          kind: PROOF_VALIDATION_CAPABILITY_ID,
          proofObjective: "exact-reflection",
          proofObserved: raw.reflected,
          status: raw.status,
        }),
        observedAt: new Date(raw.observedAt).toISOString(),
        confidence: raw.reflected ? 1 : 0.9,
        authorizationSnapshotRef: context.authorizationSnapshotRef,
        executionMode: "validation",
      });
      return Object.freeze([observation]);
    },
    cleanup(context: CleanupContext) {
      return runner.cleanup(context);
    },
  });
}

export type ProofLifecycleResult =
  | { status: "succeeded" | "no_signal"; observations: readonly Observation[] }
  | { status: "provider_failed"; errorCode: string }
  | { status: "cleanup_failed_incident"; errorCode: string };

export async function executeProofValidationLifecycle(input: {
  provider: ReturnType<typeof createReflectionProofProvider>;
  request: ReflectionProofRequest;
  executionContext: ProviderExecutionContext;
  normalizationContext: ProviderNormalizationContext;
  signal: AbortSignal;
}): Promise<ProofLifecycleResult> {
  let raw: ReflectionProofRawResult | null = null;
  let executionError: unknown = null;
  try {
    raw = await input.provider.execute(input.request, input.executionContext, input.signal);
  } catch (error) {
    executionError = error;
  }

  const cleanup = await input.provider.cleanup({
    workspaceId: input.executionContext.workspaceId,
    actionId: input.executionContext.actionId,
    authorizationId: input.executionContext.authorizationId,
  });
  if (!cleanup.ok) {
    return { status: "cleanup_failed_incident", errorCode: cleanup.code };
  }
  if (executionError || !raw) {
    return {
      status: "provider_failed",
      errorCode: executionError instanceof Error ? executionError.message : "PROOF_VALIDATION_PROVIDER_FAILED",
    };
  }

  const observations = await input.provider.normalize(raw, input.normalizationContext);
  return {
    status: raw.reflected ? "succeeded" : "no_signal",
    observations,
  };
}
