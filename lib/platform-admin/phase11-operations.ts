import { randomUUID } from "node:crypto";
import type { Phase10cDatabase } from "@/lib/database.phase10c.types";
import type { Json } from "@/lib/database.types";
import type { Phase11RpcClient } from "@/lib/database.phase11.types";
import { createPentestRun } from "@/lib/pentest-runs/create-run";
import { advancePentestRun } from "@/lib/pentest-runs/advance-run";
import { createPentestRunRepository } from "@/lib/pentest-runs/repository";
import type {
  AdvancePentestRunDependencies,
  PentestRunRepository,
  QueueApprovedActionInput,
  QueueApprovedActionResult,
} from "@/lib/pentest-runs/types";
import { persistPentestGraphState, type PersistGraphStateInput } from "@/lib/pentest-graph/persistence";
import { createPhase11HttpWorkerQueueServerDependencies } from "@/lib/phase11-http-worker/queue-server-dependencies";
import { requirePlatformAdmin } from "@/lib/platform-admin/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  makeCapabilityDescriptor,
  phase11StableId,
  type CapabilityDescriptor,
} from "@/packages/security-planning";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AUTHORIZATION_TTL_MS = 5 * 60_000;
const RUN_DEADLINE_MS = 30_000;

const capabilityResult = makeCapabilityDescriptor({
  capabilityId: "web.http.probe.v1",
  version: "1.0.0",
  supportedAssetTypes: ["http_service", "api"],
  requiredObservationTypes: [],
  mode: "safe_active",
  expectedEffects: ["root_response_observed"],
  evidenceTypes: ["http.response.metadata"],
  maxRequestBudget: 1,
  maxRuntimeMs: 5_000,
  stateMutationClass: "none",
  credentialClasses: [],
  sessionClasses: [],
  cleanupRequired: false,
  providerIds: ["scopeforge.http-discovery"],
  closedParameters: {
    discoveryProfile: "root-only",
    methodProfile: "GET_ONLY",
    followSameOriginRedirects: false,
  },
});
if (!capabilityResult.ok) throw new Error(capabilityResult.error.message);
const HTTP_CANARY_CAPABILITY: CapabilityDescriptor = capabilityResult.value;

export interface Phase11CanaryAsset {
  id: string;
  workspaceId: string;
  kind: "web_application" | "api";
  name: string;
  canonicalTarget: string;
  verifiedAt: string;
  role: "owner" | "admin";
}

export class Phase11CanaryError extends Error {
  constructor(
    readonly code:
      | "PHASE11_CANARY_ASSET_INVALID"
      | "PHASE11_CANARY_ASSET_NOT_AUTHORIZED"
      | "PHASE11_CANARY_QUEUE_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "Phase11CanaryError";
  }
}

export interface Phase11CanaryDependencies {
  authorize(): Promise<{ actorId: string }>;
  loadEligibleAsset(assetId: string, actorId: string): Promise<Phase11CanaryAsset | null>;
  repository: PentestRunRepository;
  persistGraph(input: PersistGraphStateInput): Promise<unknown>;
  enqueueApprovedAction(input: QueueApprovedActionInput): Promise<QueueApprovedActionResult>;
  cancelQueuedAction(input: Parameters<AdvancePentestRunDependencies["cancelQueuedAction"]>[0]): Promise<void>;
  writeAuditEvent(input: {
    actorUserId: string;
    action: string;
    targetWorkspaceId: string;
    reason: string;
    metadata: Json;
  }): Promise<void>;
  now(): Date;
  createId(): string;
}

function eligibleAsset(row: {
  id: string;
  workspace_id: string;
  kind: string;
  name: string;
  canonical_target: string;
  verification_status: string;
  verified_at: string | null;
}, role: string): Phase11CanaryAsset | null {
  if ((role !== "owner" && role !== "admin")
      || (row.kind !== "web_application" && row.kind !== "api")
      || row.verification_status !== "verified"
      || !row.verified_at) return null;
  try {
    const target = new URL(row.canonical_target);
    if (target.protocol !== "https:" || target.username || target.password || target.search || target.hash) return null;
  } catch {
    return null;
  }
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    kind: row.kind,
    name: row.name,
    canonicalTarget: row.canonical_target,
    verifiedAt: row.verified_at,
    role,
  };
}

function createDefaultDependencies(): Phase11CanaryDependencies {
  const admin = createAdminClient<Phase10cDatabase>();
  const rpcAdmin = createAdminClient() as unknown as Phase11RpcClient;
  const repository = createPentestRunRepository(rpcAdmin);
  const queue = createPhase11HttpWorkerQueueServerDependencies();
  return {
    authorize: async () => {
      const context = await requirePlatformAdmin();
      return { actorId: context.user.id };
    },
    loadEligibleAsset: async (assetId, actorId) => {
      const [{ data: asset, error: assetError }, { data: memberships, error: membershipError }] = await Promise.all([
        admin.from("assets")
          .select("id,workspace_id,kind,name,canonical_target,verification_status,verified_at")
          .eq("id", assetId)
          .maybeSingle(),
        admin.from("workspace_members")
          .select("workspace_id,role")
          .eq("user_id", actorId),
      ]);
      if (assetError || membershipError || !asset) return null;
      const membership = (memberships ?? []).find((row) => row.workspace_id === asset.workspace_id);
      return membership ? eligibleAsset(asset, membership.role) : null;
    },
    repository,
    persistGraph: (input) => persistPentestGraphState(rpcAdmin, input),
    enqueueApprovedAction: queue.enqueueApprovedAction,
    cancelQueuedAction: queue.cancelQueuedAction,
    writeAuditEvent: async (input) => {
      const { error } = await admin.from("platform_admin_audit_events").insert({
        actor_user_id: input.actorUserId,
        action: input.action,
        target_workspace_id: input.targetWorkspaceId,
        reason: input.reason,
        metadata: input.metadata,
      });
      if (error) throw new Error("PHASE11_CANARY_AUDIT_FAILED");
    },
    now: () => new Date(),
    createId: randomUUID,
  };
}

export async function listPhase11CanaryAssets(): Promise<readonly Phase11CanaryAsset[]> {
  const context = await requirePlatformAdmin();
  const admin = createAdminClient<Phase10cDatabase>();
  const { data: memberships, error: membershipError } = await admin
    .from("workspace_members")
    .select("workspace_id,role")
    .eq("user_id", context.user.id);
  if (membershipError) throw new Error("Unable to load Phase 11 canary assets.");
  const allowed = new Map((memberships ?? [])
    .filter((row) => row.role === "owner" || row.role === "admin")
    .map((row) => [row.workspace_id, row.role] as const));
  if (allowed.size === 0) return Object.freeze([]);

  const { data: assets, error: assetError } = await admin
    .from("assets")
    .select("id,workspace_id,kind,name,canonical_target,verification_status,verified_at")
    .in("workspace_id", [...allowed.keys()])
    .in("kind", ["web_application", "api"])
    .eq("verification_status", "verified")
    .order("name", { ascending: true });
  if (assetError) throw new Error("Unable to load Phase 11 canary assets.");
  return Object.freeze((assets ?? []).flatMap((asset) => {
    const candidate = eligibleAsset(asset, allowed.get(asset.workspace_id) ?? "");
    return candidate ? [candidate] : [];
  }));
}

export async function launchPhase11HttpCanary(
  input: { assetId: string },
  dependencies?: Phase11CanaryDependencies,
) {
  if (!UUID.test(input.assetId)) {
    throw new Phase11CanaryError("PHASE11_CANARY_ASSET_INVALID", "Choose a valid verified asset.");
  }
  const deps = dependencies ?? createDefaultDependencies();
  const actor = await deps.authorize();
  const asset = await deps.loadEligibleAsset(input.assetId, actor.actorId);
  if (!asset) {
    throw new Phase11CanaryError(
      "PHASE11_CANARY_ASSET_NOT_AUTHORIZED",
      "The selected asset is not an authorized verified HTTPS web or API target.",
    );
  }

  const now = deps.now();
  const authorizationExpiresAt = new Date(now.getTime() + AUTHORIZATION_TTL_MS).toISOString();
  const deadlineAt = new Date(now.getTime() + RUN_DEADLINE_MS).toISOString();
  const policy = {
    planner: {
      maxActionsPerIteration: 1,
      capabilityWeights: {},
      capabilityReliability: { [HTTP_CANARY_CAPABILITY.capabilityId]: 1 },
    },
    workspace: {
      maxExecutionMode: "safe_active" as const,
      maxRequestsPerAction: 1,
      maxRuntimeMsPerAction: 5_000,
      authorizationTtlMs: AUTHORIZATION_TTL_MS,
      labWorkspace: false,
    },
    limits: { requestBudget: 1, graphExpansionLimit: 1, providerFailureLimit: 1 },
  };
  const created = await createPentestRun({
    actorId: actor.actorId,
    workspaceId: asset.workspaceId,
    role: asset.role,
    assetId: asset.id,
    policy,
    authorizationExpiresAt,
    deadlineAt,
  }, {
    repository: deps.repository,
    loadAsset: async () => ({
      id: asset.id,
      workspace_id: asset.workspaceId,
      kind: asset.kind,
      verification_status: "verified",
      verified_at: asset.verifiedAt,
    }),
    createId: deps.createId,
    now: () => now,
  });

  const state = await deps.repository.loadPlanningState(
    asset.workspaceId,
    created.runId,
    created.authorizationSnapshotRef,
  );
  const hypothesisId = phase11StableId("phase11-hypothesis", [
    created.runId,
    created.rootNodeId,
    HTTP_CANARY_CAPABILITY.capabilityId,
  ]);
  await deps.persistGraph({
    workspaceId: asset.workspaceId,
    runId: created.runId,
    authorizationSnapshotRef: created.authorizationSnapshotRef,
    graph: state.graph,
    hypotheses: [{
      hypothesisId,
      reasoningSource: "scopeforge.phase11.http-root-canary.v1",
      targetNodeIds: [created.rootNodeId],
      statement: "Observe the verified HTTPS root response within the safe-active canary budget.",
      preconditions: [],
      candidateCapabilityIds: [HTTP_CANARY_CAPABILITY.capabilityId],
      expectedEvidenceTypes: [...HTTP_CANARY_CAPABILITY.evidenceTypes],
      baseConfidence: 1,
      confidence: 1,
      status: "eligible",
      evidenceRefs: [],
    }],
    coverage: state.coverage,
  });

  const advanced = await advancePentestRun({
    workspaceId: asset.workspaceId,
    runId: created.runId,
    authorizationSnapshotRef: created.authorizationSnapshotRef,
  }, {
    repository: deps.repository,
    capabilities: [HTTP_CANARY_CAPABILITY],
    enqueueApprovedAction: deps.enqueueApprovedAction,
    cancelQueuedAction: deps.cancelQueuedAction,
    now: () => now,
  });
  if (advanced.queuedActionIds.length !== 1
      || advanced.replayedActionIds.length > 0
      || advanced.approvalRequiredActionIds.length > 0
      || advanced.rejectedActionIds.length > 0) {
    throw new Phase11CanaryError("PHASE11_CANARY_QUEUE_FAILED", "The bounded Phase 11 canary was not queued safely.");
  }

  await deps.writeAuditEvent({
    actorUserId: actor.actorId,
    action: "phase11.canary_queued",
    targetWorkspaceId: asset.workspaceId,
    reason: "Bounded Phase 11 HTTP production canary",
    metadata: {
      runId: created.runId,
      assetId: asset.id,
      actionId: advanced.queuedActionIds[0],
      capabilityId: HTTP_CANARY_CAPABILITY.capabilityId,
      requestCeiling: 1,
      runtimeCeilingMs: 5_000,
    },
  });

  return Object.freeze({
    runId: created.runId,
    authorizationSnapshotRef: created.authorizationSnapshotRef,
    queuedActionIds: advanced.queuedActionIds,
  });
}
