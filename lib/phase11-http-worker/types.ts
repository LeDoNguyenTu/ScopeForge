import type { AssetNodeType } from "@/packages/security-planning";
import type {
  HttpDiscoveryCapabilityId,
  HttpDiscoveryProfile,
  HttpDiscoveryMethodProfile,
} from "@/packages/runtime-worker-mediator/http-discovery";
import type { AuthorizedRuntimeTarget } from "@/packages/runtime-observer";

export interface Phase11HttpWorkerBinding {
  taskId: string;
  workspaceId: string;
  runId: string;
  actionId: string;
  authorizationId: string;
  authorizationSnapshotRef: string;
  targetNodeId: string;
  capabilityId: HttpDiscoveryCapabilityId;
  capabilityVersion: "1.0.0";
  providerId: "scopeforge.http-discovery";
  providerVersion: "1.0.0";
}

export interface Phase11HttpWorkerAuthoritativeState {
  binding: Phase11HttpWorkerBinding;
  run: {
    status: "created" | "running" | "waiting_approval" | "completed" | "cancelled" | "failed";
    authorizationSnapshotRef: string;
  };
  snapshot: {
    snapshotRef: string;
    authorizedNodeIds: readonly string[];
    expiresAt: string;
  };
  action: {
    state: "approval_required" | "rejected" | "authorized" | "enqueueing" | "queued" | "running" | "terminal" | "cancelled";
    decisionStatus: "approved" | "narrowed" | "approval_required" | "rejected";
    authorizationId: string | null;
    authorizationSnapshotRef: string;
    capabilityId: string;
    capabilityVersion: string;
    targetNodeIds: readonly string[];
    requestedMode: "passive" | "safe_active" | "intrusive" | "validation";
    closedParameters: Readonly<Record<string, string | number | boolean>>;
    maxRequests: number | null;
    maxRuntimeMs: number | null;
    authorizationExpiresAt: string | null;
  };
  targetNode: {
    nodeId: string;
    assetType: AssetNodeType;
    canonicalLocator: string;
    authorizationRef: string;
  };
}

export interface Phase11HttpWorkerStateRepository {
  loadAuthoritativeState(input: {
    taskId: string;
    workspaceId: string;
    runId: string;
    actionId: string;
    authorizationId: string;
  }): Promise<Phase11HttpWorkerAuthoritativeState>;
}

export interface PreparedPhase11HttpWorkerExecution {
  taskId: string;
  workspaceId: string;
  runId: string;
  actionId: string;
  authorizationId: string;
  authorizationSnapshotRef: string;
  targetNodeId: string;
  target: AuthorizedRuntimeTarget;
  capabilityId: HttpDiscoveryCapabilityId;
  discoveryProfile: HttpDiscoveryProfile;
  methodProfile: HttpDiscoveryMethodProfile;
  followSameOriginRedirects: boolean;
  budget: Readonly<{
    maxRequests: number;
    perRequestTimeoutMs: number;
    totalTimeoutMs: number;
  }>;
  expiresAt: string;
}

export interface PreparePhase11HttpWorkerDependencies {
  repository: Phase11HttpWorkerStateRepository;
  now?: () => Date;
}
