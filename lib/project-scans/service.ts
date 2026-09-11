import type { Phase10a2Database } from "@/lib/database.phase10a2.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  createInstallationToken,
  getInstallationRepository,
} from "@/lib/github-app/client";
import { getGitHubAppConfig } from "@/lib/github-app/config";
import type { GitHubRepositorySummary } from "@/lib/github-app/types";
import { HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED } from "@/lib/repository-scans/runtime";
import {
  HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED,
  HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED,
} from "@/lib/repository-snapshots/runtime";
import {
  ProjectScanError,
  type ConnectedProjectContinuationContext,
  type ConnectedProjectScanContext,
  type ConnectedProjectScanRecovery,
  type ProjectScanContinuationResult,
  type ProjectScanErrorCode,
  type ProjectScanRequestResult,
  type ProjectScanResumeResult,
  type ProjectScanState,
  type RecoverableProjectScanState,
} from "./types";

export { ProjectScanError } from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ProjectScanServiceDependencies {
  loadAuthorizedProject(input: {
    workspaceId: string;
    assetId: string;
    actorId: string;
  }): Promise<ConnectedProjectScanContext>;
  revalidateRepository(context: ConnectedProjectScanContext): Promise<GitHubRepositorySummary>;
  enqueueSnapshotIntent(context: ConnectedProjectScanContext): Promise<{ taskId: string }>;
  enqueuePrivateSnapshotIntent(context: ConnectedProjectScanContext): Promise<{ taskId: string }>;
  loadContinuation(input: {
    snapshotTaskId: string;
    snapshotId: string;
  }): Promise<ConnectedProjectContinuationContext | null>;
  loadRecovery(input: {
    workspaceId: string;
    assetId: string;
    actorId: string;
    linkId: string;
  }): Promise<ConnectedProjectScanRecovery | null>;
  markWaitingForScanRuntime(context: ConnectedProjectContinuationContext): Promise<void>;
  enqueueScanContinuation(context: ConnectedProjectContinuationContext): Promise<{
    taskId: string;
    scanJobId: string;
    replayed: boolean;
  }>;
  recordRetryPending(context: ConnectedProjectContinuationContext): Promise<void>;
  snapshotRuntimeEnabled(): boolean;
  privateSnapshotRuntimeEnabled(): boolean;
  scanRuntimeEnabled(): boolean;
}

function failure(code: ProjectScanErrorCode, message: string): ProjectScanError {
  return new ProjectScanError(code, message);
}

function validUuid(value: string): string {
  if (!UUID_PATTERN.test(value)) throw failure("PROJECT_SCAN_INPUT_INVALID", "Connected project identifier is invalid.");
  return value;
}

function parseProjectState(value: unknown): ProjectScanState {
  if (
    value !== "idle"
    && value !== "snapshot_queued"
    && value !== "waiting_scan_runtime"
    && value !== "scan_queued"
    && value !== "retry_pending"
  ) {
    throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected project scan state is invalid.");
  }
  return value;
}

function parseContinuation(value: unknown): ConnectedProjectContinuationContext | null {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected project scan continuation is invalid.");
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.workspaceId !== "string"
    || typeof row.assetId !== "string"
    || typeof row.actorId !== "string"
    || typeof row.linkId !== "string"
    || typeof row.repositoryId !== "number"
    || typeof row.canonicalTarget !== "string"
    || typeof row.isPrivate !== "boolean"
    || (row.accessStatus !== "active" && row.accessStatus !== "inaccessible" && row.accessStatus !== "removed")
    || typeof row.snapshotTaskId !== "string"
    || typeof row.snapshotId !== "string"
  ) {
    throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected project scan continuation is invalid.");
  }
  return {
    workspaceId: validUuid(row.workspaceId),
    assetId: validUuid(row.assetId),
    actorId: validUuid(row.actorId),
    linkId: validUuid(row.linkId),
    repositoryId: row.repositoryId,
    canonicalTarget: row.canonicalTarget,
    isPrivate: row.isPrivate,
    accessStatus: row.accessStatus,
    snapshotTaskId: validUuid(row.snapshotTaskId),
    snapshotId: validUuid(row.snapshotId),
    state: parseProjectState(row.state),
  };
}

function parseRecovery(value: unknown): ConnectedProjectScanRecovery | null {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected project scan recovery state is invalid.");
  }
  const row = value as Record<string, unknown>;
  if (typeof row.snapshotTaskId !== "string" || typeof row.snapshotId !== "string") {
    throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected project scan recovery state is invalid.");
  }
  const state = parseProjectState(row.state);
  if (state !== "waiting_scan_runtime" && state !== "retry_pending" && state !== "scan_queued") {
    throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected project scan recovery state is invalid.");
  }
  return {
    snapshotTaskId: validUuid(row.snapshotTaskId),
    snapshotId: validUuid(row.snapshotId),
    state: state as RecoverableProjectScanState,
  };
}

function parseScanEnqueue(value: unknown): { taskId: string; scanJobId: string; replayed: boolean } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected project scan enqueue result is invalid.");
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.taskId !== "string"
    || typeof row.scanJobId !== "string"
    || typeof row.replayed !== "boolean"
  ) {
    throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected project scan enqueue result is invalid.");
  }
  return {
    taskId: validUuid(row.taskId),
    scanJobId: validUuid(row.scanJobId),
    replayed: row.replayed,
  };
}

function parseProjectContext(value: unknown): ConnectedProjectScanContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected project scan context is invalid.");
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.workspaceId !== "string"
    || typeof row.assetId !== "string"
    || typeof row.actorId !== "string"
    || typeof row.linkId !== "string"
    || typeof row.connectionId !== "string"
    || typeof row.installationId !== "number"
    || typeof row.repositoryId !== "number"
    || typeof row.canonicalTarget !== "string"
    || typeof row.isPrivate !== "boolean"
    || (row.accessStatus !== "active" && row.accessStatus !== "inaccessible" && row.accessStatus !== "removed")
  ) {
    throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected project scan context is invalid.");
  }
  return {
    workspaceId: validUuid(row.workspaceId),
    assetId: validUuid(row.assetId),
    actorId: validUuid(row.actorId),
    linkId: validUuid(row.linkId),
    connectionId: validUuid(row.connectionId),
    installationId: row.installationId,
    repositoryId: row.repositoryId,
    canonicalTarget: row.canonicalTarget,
    isPrivate: row.isPrivate,
    accessStatus: row.accessStatus,
  };
}

function createDefaultDependencies(): ProjectScanServiceDependencies {
  const admin = createAdminClient<Phase10a2Database>();
  return {
    loadAuthorizedProject: async (input) => {
      const supabase = await createClient<Phase10a2Database>();
      const { data, error } = await supabase.rpc("get_connected_project_scan_context", {
        target_workspace_id: input.workspaceId,
        target_asset_id: input.assetId,
      });
      if (error) throw failure("PROJECT_SCAN_NOT_CONNECTED", "Connected GitHub project could not be authorized.");
      const context = parseProjectContext(data);
      if (context.actorId !== input.actorId) {
        throw failure("PROJECT_SCAN_REPOSITORY_MISMATCH", "Connected project actor does not match the authenticated user.");
      }
      return context;
    },
    revalidateRepository: async (context) => {
      const config = getGitHubAppConfig();
      try {
        const token = await createInstallationToken(context.installationId, config, { repositoryId: context.repositoryId });
        return await getInstallationRepository(token.token, context.repositoryId);
      } catch {
        throw failure("PROJECT_SCAN_PROVIDER_FAILED", "GitHub repository access could not be verified safely.");
      }
    },
    enqueueSnapshotIntent: async (context) => {
      const { data, error } = await admin.rpc("enqueue_connected_project_snapshot", {
        target_workspace_id: context.workspaceId,
        target_asset_id: context.assetId,
        target_actor_id: context.actorId,
        target_link_id: context.linkId,
      });
      if (error || !data || typeof data !== "object" || Array.isArray(data)) {
        throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected project snapshot could not be queued safely.");
      }
      const taskId = (data as Record<string, unknown>).taskId;
      if (typeof taskId !== "string") {
        throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected project snapshot task is invalid.");
      }
      return { taskId: validUuid(taskId) };
    },
    enqueuePrivateSnapshotIntent: async (context) => {
      const { data, error } = await admin.rpc("enqueue_connected_project_private_snapshot", {
        target_workspace_id: context.workspaceId,
        target_asset_id: context.assetId,
        target_actor_id: context.actorId,
        target_link_id: context.linkId,
      });
      if (error || !data || typeof data !== "object" || Array.isArray(data)) {
        throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected private project snapshot could not be queued safely.");
      }
      const taskId = (data as Record<string, unknown>).taskId;
      if (typeof taskId !== "string") {
        throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected private project snapshot task is invalid.");
      }
      return { taskId: validUuid(taskId) };
    },
    loadContinuation: async (input) => {
      const { data, error } = await admin.rpc("get_connected_project_scan_continuation", {
        target_snapshot_task_id: input.snapshotTaskId,
        target_snapshot_id: input.snapshotId,
      });
      if (error) throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected project continuation could not be loaded safely.");
      return parseContinuation(data);
    },
    loadRecovery: async (input) => {
      const { data, error } = await admin.rpc("get_connected_project_scan_recovery", {
        target_workspace_id: input.workspaceId,
        target_asset_id: input.assetId,
        target_actor_id: input.actorId,
        target_link_id: input.linkId,
      });
      if (error) throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected project recovery could not be loaded safely.");
      return parseRecovery(data);
    },
    markWaitingForScanRuntime: async (context) => {
      const { error } = await admin.rpc("mark_connected_project_scan_waiting", {
        target_snapshot_task_id: context.snapshotTaskId,
        target_snapshot_id: context.snapshotId,
      });
      if (error) throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected project waiting state could not be recorded safely.");
    },
    enqueueScanContinuation: async (context) => {
      const { data, error } = await admin.rpc("enqueue_connected_project_scan", {
        target_snapshot_task_id: context.snapshotTaskId,
        target_snapshot_id: context.snapshotId,
      });
      if (error) throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected project scan continuation could not be queued safely.");
      return parseScanEnqueue(data);
    },
    recordRetryPending: async (context) => {
      const { error } = await admin.rpc("record_connected_project_scan_retry", {
        target_snapshot_task_id: context.snapshotTaskId,
        target_snapshot_id: context.snapshotId,
      });
      if (error) throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected project retry state could not be recorded safely.");
    },
    snapshotRuntimeEnabled: () => HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED,
    privateSnapshotRuntimeEnabled: () => HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED,
    scanRuntimeEnabled: () => HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED,
  };
}

function assertContextMatchesRequest(
  context: ConnectedProjectScanContext,
  input: { workspaceId: string; assetId: string; actorId: string },
): void {
  if (
    context.workspaceId !== input.workspaceId
    || context.assetId !== input.assetId
    || context.actorId !== input.actorId
  ) {
    throw failure("PROJECT_SCAN_REPOSITORY_MISMATCH", "Connected project authorization does not match the requested repository.");
  }
  if (context.accessStatus !== "active") {
    throw failure("PROJECT_SCAN_ACCESS_INACTIVE", "The connected GitHub repository is no longer active.");
  }
}

function assertProviderIdentity(
  context: ConnectedProjectScanContext,
  repository: GitHubRepositorySummary,
): void {
  if (
    repository.id !== context.repositoryId
    || repository.htmlUrl !== context.canonicalTarget
    || repository.isPrivate !== context.isPrivate
  ) {
    throw failure("PROJECT_SCAN_REPOSITORY_MISMATCH", "GitHub repository identity changed since it was connected.");
  }
}

function assertContinuationMatchesProject(
  continuation: ConnectedProjectContinuationContext,
  context: ConnectedProjectScanContext,
  recovery: ConnectedProjectScanRecovery,
): void {
  if (
    continuation.workspaceId !== context.workspaceId
    || continuation.assetId !== context.assetId
    || continuation.actorId !== context.actorId
    || continuation.linkId !== context.linkId
    || continuation.repositoryId !== context.repositoryId
    || continuation.canonicalTarget !== context.canonicalTarget
    || continuation.isPrivate !== context.isPrivate
    || continuation.snapshotTaskId !== recovery.snapshotTaskId
    || continuation.snapshotId !== recovery.snapshotId
    || continuation.accessStatus !== "active"
  ) {
    throw failure("PROJECT_SCAN_REPOSITORY_MISMATCH", "Published snapshot no longer matches the connected project recovery intent.");
  }
}

async function verifyProviderIdentity(
  context: ConnectedProjectScanContext,
  deps: ProjectScanServiceDependencies,
): Promise<void> {
  let repository: GitHubRepositorySummary;
  try {
    repository = await deps.revalidateRepository(context);
  } catch (error) {
    if (error instanceof ProjectScanError) throw error;
    throw failure("PROJECT_SCAN_PROVIDER_FAILED", "GitHub repository access could not be verified safely.");
  }
  assertProviderIdentity(context, repository);
}

export async function requestConnectedProjectScan(
  input: { workspaceId: string; assetId: string; actorId: string },
  dependencies?: ProjectScanServiceDependencies,
): Promise<ProjectScanRequestResult> {
  const request = {
    workspaceId: validUuid(input.workspaceId),
    assetId: validUuid(input.assetId),
    actorId: validUuid(input.actorId),
  };
  const deps = dependencies ?? createDefaultDependencies();
  const context = await deps.loadAuthorizedProject(request);
  assertContextMatchesRequest(context, request);

  await verifyProviderIdentity(context, deps);

  if (context.isPrivate) {
    if (!deps.privateSnapshotRuntimeEnabled()) {
      return { status: "private_snapshot_runtime_unavailable" };
    }
    const queued = await deps.enqueuePrivateSnapshotIntent(context);
    return { status: "snapshot_queued", taskId: queued.taskId };
  }
  if (!deps.snapshotRuntimeEnabled()) return { status: "snapshot_runtime_unavailable" };

  const queued = await deps.enqueueSnapshotIntent(context);
  return { status: "snapshot_queued", taskId: queued.taskId };
}

export async function continueConnectedProjectScanAfterSnapshot(
  input: { snapshotTaskId: string; snapshotId: string },
  dependencies?: ProjectScanServiceDependencies,
): Promise<ProjectScanContinuationResult> {
  const request = {
    snapshotTaskId: validUuid(input.snapshotTaskId),
    snapshotId: validUuid(input.snapshotId),
  };
  const deps = dependencies ?? createDefaultDependencies();
  const context = await deps.loadContinuation(request);
  if (!context) return { status: "ignored" };

  if (
    context.snapshotTaskId !== request.snapshotTaskId
    || context.snapshotId !== request.snapshotId
  ) {
    throw failure("PROJECT_SCAN_REPOSITORY_MISMATCH", "Published snapshot does not match the connected project intent.");
  }
  if (context.accessStatus !== "active") return { status: "ignored" };

  if (context.state === "scan_queued") {
    try {
      const queued = await deps.enqueueScanContinuation(context);
      return {
        status: "scan_queued",
        taskId: queued.taskId,
        scanJobId: queued.scanJobId,
        replayed: queued.replayed,
      };
    } catch {
      await deps.recordRetryPending(context);
      return { status: "retry_pending" };
    }
  }

  if (!deps.scanRuntimeEnabled()) {
    await deps.markWaitingForScanRuntime(context);
    return { status: "waiting_scan_runtime" };
  }

  try {
    const queued = await deps.enqueueScanContinuation(context);
    return {
      status: "scan_queued",
      taskId: queued.taskId,
      scanJobId: queued.scanJobId,
      replayed: queued.replayed,
    };
  } catch {
    await deps.recordRetryPending(context);
    return { status: "retry_pending" };
  }
}

export async function resumeConnectedProjectScan(
  input: { workspaceId: string; assetId: string; actorId: string },
  dependencies?: ProjectScanServiceDependencies,
): Promise<ProjectScanResumeResult> {
  const request = {
    workspaceId: validUuid(input.workspaceId),
    assetId: validUuid(input.assetId),
    actorId: validUuid(input.actorId),
  };
  const deps = dependencies ?? createDefaultDependencies();
  const context = await deps.loadAuthorizedProject(request);
  assertContextMatchesRequest(context, request);

  if (!deps.scanRuntimeEnabled()) return { status: "scan_runtime_unavailable" };

  const recovery = await deps.loadRecovery({
    workspaceId: request.workspaceId,
    assetId: request.assetId,
    actorId: request.actorId,
    linkId: context.linkId,
  });
  if (!recovery) return { status: "no_pending_scan" };

  await verifyProviderIdentity(context, deps);

  const continuation = await deps.loadContinuation({
    snapshotTaskId: recovery.snapshotTaskId,
    snapshotId: recovery.snapshotId,
  });
  if (!continuation) {
    throw failure("PROJECT_SCAN_PERSIST_FAILED", "Published snapshot recovery state could not be reconstructed safely.");
  }
  assertContinuationMatchesProject(continuation, context, recovery);

  try {
    const queued = await deps.enqueueScanContinuation(continuation);
    return {
      status: "scan_queued",
      taskId: queued.taskId,
      scanJobId: queued.scanJobId,
      replayed: queued.replayed,
    };
  } catch {
    await deps.recordRetryPending(continuation);
    return { status: "retry_pending" };
  }
}

export {
  reconcileAutomaticProjectScanAfterSnapshot,
  reconcilePendingAutomaticProjectScanAfterRepositoryScanTerminal,
} from "./automatic-reconciliation";
export type { AutomaticProjectScanReconciliationDependencies } from "./automatic-reconciliation";
