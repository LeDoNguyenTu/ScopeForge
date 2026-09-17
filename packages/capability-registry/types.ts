import type { ExecutionMode, Observation } from "../security-planning";

export type ProviderHealth = "healthy" | "degraded" | "unavailable";

export type ProviderValidationResult =
  | { ok: true }
  | { ok: false; code: string };

export interface ProviderPolicyContext {
  workspaceId: string;
  authorizationSnapshotRef: string;
  executionMode: ExecutionMode;
}

export interface ProviderExecutionContext {
  workspaceId: string;
  actionId: string;
  authorizationId: string;
  targetNodeIds: readonly string[];
  maxRequests: number;
  maxRuntimeMs: number;
}

export interface ProviderNormalizationContext {
  runId: string;
  actionId: string;
  authorizationSnapshotRef: string;
}

export interface CleanupContext {
  workspaceId: string;
  actionId: string;
  authorizationId: string;
}

export type CleanupResult =
  | { ok: true }
  | { ok: false; code: string };

export interface CapabilityProvider<Req = unknown, Raw = unknown, Obs extends Observation = Observation> {
  readonly providerId: string;
  readonly version: string;
  readonly capabilityIds: readonly string[];
  readonly supportedModes: readonly ExecutionMode[];
  validateRequest(request: Req, context: ProviderPolicyContext): ProviderValidationResult;
  execute(
    request: Req,
    context: ProviderExecutionContext,
    signal: AbortSignal,
  ): Promise<Raw>;
  normalize(
    raw: Raw,
    context: ProviderNormalizationContext,
  ): Promise<readonly Obs[]>;
  cleanup(context: CleanupContext): Promise<CleanupResult>;
}

export interface ProviderRegistration {
  provider: CapabilityProvider;
  enabled: boolean;
  health: ProviderHealth;
  priority: number;
}

export type ProviderSelection =
  | { ok: true; provider: CapabilityProvider }
  | {
      ok: false;
      code:
        | "UNKNOWN_CAPABILITY"
        | "MODE_UNSUPPORTED"
        | "PROVIDER_DISABLED"
        | "PROVIDER_UNAVAILABLE";
    };
