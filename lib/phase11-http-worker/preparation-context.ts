import { WorkerControlError } from "@/lib/worker-control/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Phase11cWorkerDatabase } from "@/lib/database.phase11c.types";
import type { Phase11HttpWorkerAuthoritativeState } from "./types";

export interface Phase11HttpWorkerLeaseIdentity {
  workerId: string;
  taskId: string;
  attemptId: string;
  leaseToken: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTION_ID = /^phase11-action:[0-9a-f]{64}$/;
const AUTHORIZATION_ID = /^phase11-authz:[0-9a-f]{64}$/;
const ASSET_TYPES = new Set([
  "repository", "domain", "hostname", "ip_endpoint", "http_service", "api",
  "api_operation", "cloud_account", "cloud_resource", "container_image",
  "kubernetes_workload", "mobile_application", "identity",
]);

function fail(): never {
  throw new WorkerControlError("RUNTIME_WORKER_TASK_INVALID");
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

function text(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) fail();
  return value;
}

function uuid(value: unknown): string {
  const parsed = text(value);
  if (!UUID.test(parsed)) fail();
  return parsed;
}

function iso(value: unknown): string {
  const parsed = text(value);
  if (!Number.isFinite(Date.parse(parsed))) fail();
  return parsed;
}

function strings(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) fail();
  return Object.freeze([...value]) as readonly string[];
}

function nullablePositiveInteger(value: unknown): number | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || (value as number) < 1) fail();
  return value as number;
}

function closedParameters(value: unknown): Readonly<Record<string, string | number | boolean>> {
  const parsed = record(value);
  for (const item of Object.values(parsed)) {
    if (typeof item !== "string" && typeof item !== "number" && typeof item !== "boolean") fail();
  }
  return Object.freeze(parsed as Record<string, string | number | boolean>);
}

function parseState(value: unknown): Phase11HttpWorkerAuthoritativeState {
  const root = record(value);
  exact(root, ["binding", "run", "snapshot", "action", "targetNode"]);
  const binding = record(root.binding);
  const run = record(root.run);
  const snapshot = record(root.snapshot);
  const action = record(root.action);
  const targetNode = record(root.targetNode);
  exact(binding, [
    "taskId", "workspaceId", "runId", "actionId", "authorizationId",
    "authorizationSnapshotRef", "targetNodeId", "capabilityId", "capabilityVersion",
    "providerId", "providerVersion",
  ]);
  exact(run, ["status", "authorizationSnapshotRef"]);
  exact(snapshot, ["snapshotRef", "authorizedNodeIds", "expiresAt"]);
  exact(action, [
    "state", "decisionStatus", "authorizationId", "authorizationSnapshotRef",
    "capabilityId", "capabilityVersion", "targetNodeIds", "requestedMode",
    "closedParameters", "maxRequests", "maxRuntimeMs", "authorizationExpiresAt",
  ]);
  exact(targetNode, ["nodeId", "assetType", "canonicalLocator", "authorizationRef"]);

  const actionId = text(binding.actionId);
  const authorizationId = text(binding.authorizationId);
  const capabilityId = text(binding.capabilityId);
  if (!ACTION_ID.test(actionId) || !AUTHORIZATION_ID.test(authorizationId)
      || (capabilityId !== "web.http.probe.v1" && capabilityId !== "web.route.discover.v1")
      || binding.capabilityVersion !== "1.0.0"
      || binding.providerId !== "scopeforge.http-discovery"
      || binding.providerVersion !== "1.0.0") fail();
  const runStatus = text(run.status);
  if (!["created", "running", "waiting_approval", "completed", "cancelled", "failed"].includes(runStatus)) fail();
  const actionState = text(action.state);
  if (!["approval_required", "rejected", "authorized", "enqueueing", "queued", "running", "terminal", "cancelled"].includes(actionState)) fail();
  const decisionStatus = text(action.decisionStatus);
  if (!["approved", "narrowed", "approval_required", "rejected"].includes(decisionStatus)) fail();
  const requestedMode = text(action.requestedMode);
  if (!["passive", "safe_active", "intrusive", "validation"].includes(requestedMode)) fail();
  const assetType = text(targetNode.assetType);
  if (!ASSET_TYPES.has(assetType)) fail();

  return Object.freeze({
    binding: Object.freeze({
      taskId: uuid(binding.taskId),
      workspaceId: uuid(binding.workspaceId),
      runId: uuid(binding.runId),
      actionId,
      authorizationId,
      authorizationSnapshotRef: text(binding.authorizationSnapshotRef),
      targetNodeId: text(binding.targetNodeId),
      capabilityId: capabilityId as "web.http.probe.v1" | "web.route.discover.v1",
      capabilityVersion: "1.0.0",
      providerId: "scopeforge.http-discovery",
      providerVersion: "1.0.0",
    }),
    run: Object.freeze({
      status: runStatus as Phase11HttpWorkerAuthoritativeState["run"]["status"],
      authorizationSnapshotRef: text(run.authorizationSnapshotRef),
    }),
    snapshot: Object.freeze({
      snapshotRef: text(snapshot.snapshotRef),
      authorizedNodeIds: strings(snapshot.authorizedNodeIds),
      expiresAt: iso(snapshot.expiresAt),
    }),
    action: Object.freeze({
      state: actionState as Phase11HttpWorkerAuthoritativeState["action"]["state"],
      decisionStatus: decisionStatus as Phase11HttpWorkerAuthoritativeState["action"]["decisionStatus"],
      authorizationId: action.authorizationId === null ? null : text(action.authorizationId),
      authorizationSnapshotRef: text(action.authorizationSnapshotRef),
      capabilityId: text(action.capabilityId),
      capabilityVersion: text(action.capabilityVersion),
      targetNodeIds: strings(action.targetNodeIds),
      requestedMode: requestedMode as Phase11HttpWorkerAuthoritativeState["action"]["requestedMode"],
      closedParameters: closedParameters(action.closedParameters),
      maxRequests: nullablePositiveInteger(action.maxRequests),
      maxRuntimeMs: nullablePositiveInteger(action.maxRuntimeMs),
      authorizationExpiresAt: action.authorizationExpiresAt === null ? null : iso(action.authorizationExpiresAt),
    }),
    targetNode: Object.freeze({
      nodeId: text(targetNode.nodeId),
      assetType: assetType as Phase11HttpWorkerAuthoritativeState["targetNode"]["assetType"],
      canonicalLocator: text(targetNode.canonicalLocator),
      authorizationRef: text(targetNode.authorizationRef),
    }),
  });
}

export function createPhase11HttpWorkerPreparationContextRepository(
  client: SupabaseClient<Phase11cWorkerDatabase>,
) {
  return Object.freeze({
    async getPreparationContext(
      input: Phase11HttpWorkerLeaseIdentity,
    ): Promise<Phase11HttpWorkerAuthoritativeState> {
      const { data, error } = await client.rpc("get_phase11_http_worker_preparation_context", {
        target_worker_id: input.workerId,
        target_task_id: input.taskId,
        target_attempt_id: input.attemptId,
        target_lease_token: input.leaseToken,
      });
      if (error) fail();
      const state = parseState(data);
      if (state.binding.taskId !== input.taskId) fail();
      return state;
    },
  });
}

export type Phase11HttpWorkerPreparationContextRepository = ReturnType<
  typeof createPhase11HttpWorkerPreparationContextRepository
>;
