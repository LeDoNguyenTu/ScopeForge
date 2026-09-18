import { assetRef } from "@/packages/security-domain";
import type { AuthorizedRuntimeTarget } from "@/packages/runtime-observer";
import {
  parsePhase11HttpClosedParameters,
  phase11HttpRequiredRequestCapacity,
} from "./closed-parameters";
import type {
  Phase11HttpWorkerAuthoritativeState,
  PreparePhase11HttpWorkerDependencies,
  PreparedPhase11HttpWorkerExecution,
} from "./types";

const WEB_NODE_TYPES = new Set(["domain", "hostname", "http_service", "api", "api_operation"]);
const MAX_REQUESTS = 12;
const MAX_PER_REQUEST_TIMEOUT_MS = 5_000;
const MAX_TOTAL_TIMEOUT_MS = 30_000;

function fail(code: string): never {
  throw new Error(code);
}

function parseTarget(state: Phase11HttpWorkerAuthoritativeState): AuthorizedRuntimeTarget {
  const node = state.targetNode;
  if (!WEB_NODE_TYPES.has(node.assetType)) fail("PHASE11_HTTP_TARGET_TYPE_INVALID");

  let url: URL;
  try {
    url = new URL(node.canonicalLocator);
  } catch {
    fail("PHASE11_HTTP_TARGET_URL_INVALID");
  }
  if (url.protocol !== "https:"
      || (url.port !== "" && url.port !== "443")
      || url.username
      || url.password
      || url.search
      || url.hash
      || !url.hostname) {
    fail("PHASE11_HTTP_TARGET_URL_INVALID");
  }
  url.hash = "";

  return Object.freeze({
    assetRef: assetRef(node.nodeId),
    kind: node.assetType === "api" || node.assetType === "api_operation" ? "api" : "web_application",
    canonicalUrl: url.toString(),
    hostname: url.hostname.toLowerCase(),
  });
}

function assertBinding(
  state: Phase11HttpWorkerAuthoritativeState,
  input: {
    taskId: string;
    workspaceId: string;
    runId: string;
    actionId: string;
    authorizationId: string;
  },
): void {
  const binding = state.binding;
  if (binding.taskId !== input.taskId
      || binding.workspaceId !== input.workspaceId
      || binding.runId !== input.runId
      || binding.actionId !== input.actionId
      || binding.authorizationId !== input.authorizationId) {
    fail("PHASE11_HTTP_WORKER_BINDING_MISMATCH");
  }
  if (binding.providerId !== "scopeforge.http-discovery"
      || binding.providerVersion !== "1.0.0"
      || binding.capabilityVersion !== "1.0.0") {
    fail("PHASE11_HTTP_PROVIDER_IDENTITY_INVALID");
  }
}

function assertAuthority(state: Phase11HttpWorkerAuthoritativeState, now: Date): void {
  const { binding, run, snapshot, action, targetNode } = state;

  if (run.status !== "running") fail("PHASE11_HTTP_RUN_NOT_ACTIVE");
  if (run.authorizationSnapshotRef !== binding.authorizationSnapshotRef
      || snapshot.snapshotRef !== binding.authorizationSnapshotRef
      || action.authorizationSnapshotRef !== binding.authorizationSnapshotRef) {
    fail("PHASE11_HTTP_AUTHORIZATION_SNAPSHOT_MISMATCH");
  }

  const snapshotExpiry = Date.parse(snapshot.expiresAt);
  const actionExpiry = action.authorizationExpiresAt ? Date.parse(action.authorizationExpiresAt) : Number.NaN;
  if (!Number.isFinite(snapshotExpiry)
      || !Number.isFinite(actionExpiry)
      || snapshotExpiry <= now.getTime()
      || actionExpiry <= now.getTime()) {
    fail("PHASE11_HTTP_AUTHORIZATION_EXPIRED");
  }

  if (action.state !== "enqueueing" && action.state !== "queued") {
    fail("PHASE11_HTTP_ACTION_STATE_INVALID");
  }
  if (action.decisionStatus !== "approved" && action.decisionStatus !== "narrowed") {
    fail("PHASE11_HTTP_ACTION_NOT_AUTHORIZED");
  }
  if (action.authorizationId !== binding.authorizationId) fail("PHASE11_HTTP_AUTHORIZATION_ID_MISMATCH");
  if (action.requestedMode !== "safe_active") fail("PHASE11_HTTP_EXECUTION_MODE_INVALID");
  if (action.capabilityId !== binding.capabilityId
      || action.capabilityVersion !== binding.capabilityVersion) {
    fail("PHASE11_HTTP_CAPABILITY_IDENTITY_MISMATCH");
  }
  if (action.targetNodeIds.length !== 1 || action.targetNodeIds[0] !== binding.targetNodeId) {
    fail("PHASE11_HTTP_TARGET_BINDING_INVALID");
  }
  if (targetNode.nodeId !== binding.targetNodeId
      || targetNode.authorizationRef !== binding.authorizationSnapshotRef
      || !snapshot.authorizedNodeIds.includes(binding.targetNodeId)) {
    fail("PHASE11_HTTP_TARGET_OUTSIDE_AUTHORIZATION");
  }
  if (!Number.isInteger(action.maxRequests)
      || (action.maxRequests as number) < 1
      || !Number.isInteger(action.maxRuntimeMs)
      || (action.maxRuntimeMs as number) < 1) {
    fail("PHASE11_HTTP_ACTION_BUDGET_INVALID");
  }
}

export async function preparePhase11HttpWorker(
  input: {
    taskId: string;
    workspaceId: string;
    runId: string;
    actionId: string;
    authorizationId: string;
  },
  dependencies: PreparePhase11HttpWorkerDependencies,
): Promise<PreparedPhase11HttpWorkerExecution> {
  const now = dependencies.now?.() ?? new Date();
  const state = await dependencies.repository.loadAuthoritativeState(input);

  assertBinding(state, input);
  assertAuthority(state, now);

  const params = parsePhase11HttpClosedParameters(
    state.action.closedParameters,
    state.binding.capabilityId,
  );
  const requiredRequests = phase11HttpRequiredRequestCapacity(params);
  const authorizedRequests = Math.min(MAX_REQUESTS, state.action.maxRequests as number);
  if (requiredRequests > authorizedRequests) fail("PHASE11_HTTP_REQUEST_BUDGET_INSUFFICIENT");

  const totalTimeoutMs = Math.min(MAX_TOTAL_TIMEOUT_MS, state.action.maxRuntimeMs as number);
  if (totalTimeoutMs < 1) fail("PHASE11_HTTP_RUNTIME_BUDGET_INSUFFICIENT");

  const target = parseTarget(state);
  const expiresAtMs = Math.min(
    Date.parse(state.snapshot.expiresAt),
    Date.parse(state.action.authorizationExpiresAt as string),
  );

  return Object.freeze({
    taskId: state.binding.taskId,
    workspaceId: state.binding.workspaceId,
    runId: state.binding.runId,
    actionId: state.binding.actionId,
    authorizationId: state.binding.authorizationId,
    authorizationSnapshotRef: state.binding.authorizationSnapshotRef,
    targetNodeId: state.binding.targetNodeId,
    target,
    capabilityId: state.binding.capabilityId,
    discoveryProfile: params.discoveryProfile,
    methodProfile: params.methodProfile,
    followSameOriginRedirects: params.followSameOriginRedirects,
    budget: Object.freeze({
      maxRequests: authorizedRequests,
      perRequestTimeoutMs: Math.min(MAX_PER_REQUEST_TIMEOUT_MS, totalTimeoutMs),
      totalTimeoutMs,
    }),
    expiresAt: new Date(expiresAtMs).toISOString(),
  });
}
