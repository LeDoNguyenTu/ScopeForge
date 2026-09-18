import type { Json } from "@/lib/database.types";
import type { Phase11cFinalizationDatabase } from "@/lib/database.phase11c-finalization.types";
import type { Observation } from "@/packages/security-planning";
import type { WorkerAttemptMetrics, WorkerTerminalFailureCode, WorkerTerminalOutcome } from "@/packages/worker-contracts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HttpDiscoveryCapabilityId, HttpDiscoveryProfile } from "@/packages/provider-http-discovery";
import type { Phase11HttpWorkerLeaseIdentity } from "./preparation-context";

export interface Phase11HttpWorkerFinalizationContext {
  taskId: string;
  attemptId: string;
  workspaceId: string;
  runId: string;
  actionId: string;
  authorizationId: string;
  authorizationSnapshotRef: string;
  targetNodeId: string;
  capabilityId: HttpDiscoveryCapabilityId;
  providerId: "scopeforge.http-discovery";
  providerVersion: "1.0.0";
  discoveryProfile: HttpDiscoveryProfile;
  leasedAt: string;
  leaseExpiresAt: string;
  cancelRequested: boolean;
  finishedAt: string | null;
  priorOutcome: WorkerTerminalOutcome | null;
  priorTerminalDigest: string | null;
}

export interface Phase11HttpWorkerFinalizeMutation extends Phase11HttpWorkerLeaseIdentity {
  workspaceId: string;
  runId: string;
  actionId: string;
  authorizationId: string;
  authorizationSnapshotRef: string;
  terminalDigest: string;
  outcome: WorkerTerminalOutcome;
  failureCode: WorkerTerminalFailureCode | null;
  requestCount: number;
  metrics: WorkerAttemptMetrics;
  observations: readonly Observation[];
}

export interface Phase11HttpWorkerFinalizationResult {
  outcome: WorkerTerminalOutcome;
  replayed: boolean;
}

function fail(code = "PHASE11_HTTP_WORKER_TASK_INVALID"): never {
  throw new Error(code);
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail();
  return value as Record<string, unknown>;
}

function exact(value: Record<string, unknown>, keys: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail();
}

function requiredString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) fail();
  return value;
}

function nullableString(value: unknown): string | null {
  return value === null ? null : requiredString(value);
}

function iso(value: unknown): string {
  const result = requiredString(value);
  if (!Number.isFinite(Date.parse(result))) fail();
  return result;
}

function parseContext(value: unknown): Phase11HttpWorkerFinalizationContext {
  const data = record(value);
  exact(data, [
    "taskId", "attemptId", "workspaceId", "runId", "actionId", "authorizationId",
    "authorizationSnapshotRef", "targetNodeId", "capabilityId", "providerId", "providerVersion",
    "discoveryProfile", "leasedAt", "leaseExpiresAt", "cancelRequested", "finishedAt",
    "priorOutcome", "priorTerminalDigest",
  ]);
  const capabilityId = requiredString(data.capabilityId);
  const discoveryProfile = requiredString(data.discoveryProfile);
  const priorOutcome = nullableString(data.priorOutcome);
  if ((capabilityId !== "web.http.probe.v1" && capabilityId !== "web.route.discover.v1")
      || (discoveryProfile !== "root-only" && discoveryProfile !== "well-known-safe")
      || data.providerId !== "scopeforge.http-discovery"
      || data.providerVersion !== "1.0.0"
      || typeof data.cancelRequested !== "boolean"
      || (priorOutcome !== null && !["succeeded", "failed", "cancelled"].includes(priorOutcome))) fail();
  return Object.freeze({
    taskId: requiredString(data.taskId),
    attemptId: requiredString(data.attemptId),
    workspaceId: requiredString(data.workspaceId),
    runId: requiredString(data.runId),
    actionId: requiredString(data.actionId),
    authorizationId: requiredString(data.authorizationId),
    authorizationSnapshotRef: requiredString(data.authorizationSnapshotRef),
    targetNodeId: requiredString(data.targetNodeId),
    capabilityId: capabilityId as HttpDiscoveryCapabilityId,
    providerId: "scopeforge.http-discovery",
    providerVersion: "1.0.0",
    discoveryProfile: discoveryProfile as HttpDiscoveryProfile,
    leasedAt: iso(data.leasedAt),
    leaseExpiresAt: iso(data.leaseExpiresAt),
    cancelRequested: data.cancelRequested,
    finishedAt: data.finishedAt === null ? null : iso(data.finishedAt),
    priorOutcome: priorOutcome as WorkerTerminalOutcome | null,
    priorTerminalDigest: nullableString(data.priorTerminalDigest),
  });
}

function observationRow(observation: Observation): Json {
  return {
    observation_id: observation.observationId,
    provider_id: observation.providerId,
    provider_version: observation.providerVersion,
    capability_id: observation.capabilityId,
    asset_node_ids: [...observation.assetNodeIds],
    evidence_refs: [...observation.evidenceRefs],
    facts: { ...observation.facts },
    observed_at: observation.observedAt,
    confidence: observation.confidence,
    authorization_snapshot_ref: observation.authorizationSnapshotRef,
    execution_mode: observation.executionMode,
  };
}

function parseResult(value: unknown): Phase11HttpWorkerFinalizationResult {
  const data = record(value);
  exact(data, ["outcome", "replayed"]);
  if (typeof data.outcome !== "string" || !["succeeded", "failed", "cancelled"].includes(data.outcome)
      || typeof data.replayed !== "boolean") fail();
  return Object.freeze({ outcome: data.outcome as WorkerTerminalOutcome, replayed: data.replayed });
}

export function createPhase11HttpWorkerFinalizationRepository(
  client: SupabaseClient<Phase11cFinalizationDatabase>,
) {
  return Object.freeze({
    async getContext(input: Phase11HttpWorkerLeaseIdentity): Promise<Phase11HttpWorkerFinalizationContext> {
      const { data, error } = await client.rpc("get_phase11_http_worker_finalization_context", {
        target_worker_id: input.workerId,
        target_task_id: input.taskId,
        target_attempt_id: input.attemptId,
        target_lease_token: input.leaseToken,
      });
      if (error) fail("PHASE11_HTTP_WORKER_AUTHORIZATION_FAILED");
      const context = parseContext(data);
      if (context.taskId !== input.taskId || context.attemptId !== input.attemptId) fail();
      return context;
    },
    async finalize(input: Phase11HttpWorkerFinalizeMutation): Promise<Phase11HttpWorkerFinalizationResult> {
      const { data, error } = await client.rpc("finalize_phase11_http_worker_attempt", {
        target_worker_id: input.workerId,
        target_task_id: input.taskId,
        target_attempt_id: input.attemptId,
        target_lease_token: input.leaseToken,
        target_terminal_digest: input.terminalDigest,
        target_outcome: input.outcome,
        target_failure_code: input.failureCode,
        target_request_count: input.requestCount,
        target_metrics: { ...input.metrics },
        observation_rows: input.observations.map(observationRow),
      });
      if (error) fail("PHASE11_HTTP_WORKER_FINALIZATION_FAILED");
      return parseResult(data);
    },
  });
}

export type Phase11HttpWorkerFinalizationRepository = ReturnType<
  typeof createPhase11HttpWorkerFinalizationRepository
>;
