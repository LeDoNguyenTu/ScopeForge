import type { Phase10a1Database } from "@/lib/database.phase10a1.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  createInstallationToken,
  getInstallationRepository,
} from "@/lib/github-app/client";
import { getGitHubAppConfig } from "@/lib/github-app/config";
import type { GitHubRepositorySummary } from "@/lib/github-app/types";
import { HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED } from "@/lib/repository-scans/runtime";
import { HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED } from "@/lib/repository-snapshots/runtime";
import {
  ProjectScanError,
  type ConnectedProjectContinuationContext,
  type ConnectedProjectScanContext,
  type ProjectScanContinuationResult,
  type ProjectScanErrorCode,
  type ProjectScanRequestResult,
  type ProjectScanState,
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
  snapshotRuntimeEnabled(): boolean;
  scanRuntimeEnabled(): boolean;
  enqueueSnapshotIntent(context: ConnectedProjectScanContext): Promise<{ taskId: string }>;
  loadContinuation(input: {
    snapshotTaskId: string;
    snapshotId: string;
  }): Promise<ConnectedProjectContinuationContext | null>;
  markWaitingForScanRuntime(context: ConnectedProjectContinuationContext): Promise<void>;
  enqueueScanContinuation(context: ConnectedProjectContinuationContext): Promise<{
    taskId: string;
    scanJobId: string;
    replayed: boolean;
  }>;
  recordRetryPending(context: ConnectedProjectContinuationContext): Promise<void>;
}

function failure(code: ProjectScanErrorCode, message: string): ProjectScanError {
  return new ProjectScanError(code, message);
}

function validUuid(value: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw failure("PROJECT_SCAN_INPUT_INVALID", "Connected project scan input is invalid.");
  }
  return value;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function uuidField(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

function positiveIntegerField(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function isRepositoryAccessStatus(
  value: unknown,
): value is ConnectedProjectContinuationContext["accessStatus"] {
  return value === "active" || value === "inaccessible" || value === "removed";
}

function isProjectScanState(value: unknown): value is ProjectScanState {
  return value === "idle"
    || value === "snapshot_queued"
    || value === "waiting_scan_runtime"
    || value === "scan_queued"
    || value === "retry_pending";
}

function parseSnapshotEnqueue(value: unknown): { taskId: string } {
  const row = objectValue(value);
  const taskId = uuidField(row?.taskId);
  if (!taskId) throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected project snapshot could not be queued safely.");
  return { taskId };
}

function parseContinuation(value: unknown): ConnectedProjectContinuationContext | null {
  if (value === null) return null;
  const row = objectValue(value);
  const workspaceId = uuidField(row?.workspaceId);
  const assetId = uuidField(row?.assetId);
  const actorId = uuidField(row?.actorId);
  const linkId = uuidField(row?.linkId);
  const snapshotTaskId = uuidField(row?.snapshotTaskId);
  const snapshotId = uuidField(row?.snapshotId);
  const repositoryId = positiveIntegerField(row?.repositoryId);
  const canonicalTarget = typeof row?.canonicalTarget === "string" ? row.canonicalTarget : null;
  const isPrivate = typeof row?.isPrivate === "boolean" ? row.isPrivate : null;
  const accessStatus = row?.accessStatus;
  const state = row?.state;

  if (
    !workspaceId || !assetId || !actorId || !linkId || !snapshotTaskId || !snapshotId
    || !repositoryId || !canonicalTarget || isPrivate === null
    || !isRepositoryAccessStatus(accessStatus) || !isProjectScanState(state)
  ) {
    throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected project continuation state is invalid.");
  }

  return {
    workspaceId,
    assetId,
    actorId,
    linkId,
    repositoryId,
    canonicalTarget,
    isPrivate,
    accessStatus,
    snapshotTaskId,
    snapshotId,
    state,
  };
}

function parseScanEnqueue(value: unknown): { taskId: string; scanJobId: string; replayed: boolean } {
  const row = objectValue(value);
  const taskId = uuidField(row?.taskId);
  const scanJobId = uuidField(row?.scanJobId);
  const replayed = row?.replayed;
  if (!taskId || !scanJobId || typeof replayed !== "boolean") {
    throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected project scan could not be queued safely.");
  }
  return { taskId, scanJobId, replayed };
}

function createDefaultDependencies(): ProjectScanServiceDependencies {
  const admin = createAdminClient<Phase10a1Database>();

  return {
    loadAuthorizedProject: async (input) => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== input.actorId) {
        throw failure("PROJECT_SCAN_NOT_CONNECTED", "Sign in with access to this connected project.");
      }

      const { data: membership, error: membershipError } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", input.workspaceId)
        .eq("user_id", input.actorId)
        .maybeSingle();
      if (membershipError || !membership || (membership.role !== "owner" && membership.role !== "admin")) {
        throw failure("PROJECT_SCAN_NOT_CONNECTED", "Workspace owner or admin access is required.");
      }

      const { data: link, error: linkError } = await admin
        .from("github_repository_links")
        .select("id,workspace_id,github_connection_id,asset_id,repository_id,is_private,html_url,access_status")
        .eq("workspace_id", input.workspaceId)
        .eq("asset_id", input.assetId)
        .maybeSingle();
      if (linkError) throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected project state could not be loaded safely.");
      if (!link) throw failure("PROJECT_SCAN_NOT_CONNECTED", "This repository is not connected to GitHub.");

      const { data: connection, error: connectionError } = await admin
        .from("github_connections")
        .select("id,workspace_id,installation_id,status")
        .eq("id", link.github_connection_id)
        .eq("workspace_id", input.workspaceId)
        .maybeSingle();
      if (connectionError) throw failure("PROJECT_SCAN_PERSIST_FAILED", "GitHub connection state could not be loaded safely.");
      if (!connection || connection.status !== "active" || link.access_status !== "active") {
        throw failure("PROJECT_SCAN_ACCESS_INACTIVE", "The connected GitHub repository is no longer active.");
      }

      const { data: asset, error: assetError } = await admin
        .from("assets")
        .select("id,workspace_id,kind,canonical_target")
        .eq("id", input.assetId)
        .eq("workspace_id", input.workspaceId)
        .maybeSingle();
      if (assetError) throw failure("PROJECT_SCAN_PERSIST_FAILED", "Repository asset state could not be loaded safely.");
      if (!asset || asset.kind !== "repository" || asset.canonical_target !== link.html_url) {
        throw failure("PROJECT_SCAN_REPOSITORY_MISMATCH", "Connected repository identity no longer matches the registered asset.");
      }

      return {
        workspaceId: input.workspaceId,
        assetId: input.assetId,
        actorId: input.actorId,
        linkId: link.id,
        connectionId: connection.id,
        installationId: connection.installation_id,
        repositoryId: link.repository_id,
        canonicalTarget: link.html_url,
        isPrivate: link.is_private,
        accessStatus: link.access_status,
      };
    },
    revalidateRepository: async (context) => {
      const config = getGitHubAppConfig();
      const token = await createInstallationToken(
        context.installationId,
        config,
        { repositoryId: context.repositoryId },
      );
      return getInstallationRepository(token.token, context.repositoryId);
    },
    snapshotRuntimeEnabled: () => HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED,
    scanRuntimeEnabled: () => HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED,
    enqueueSnapshotIntent: async (context) => {
      const { data, error } = await admin.rpc("enqueue_connected_project_snapshot", {
        target_workspace_id: context.workspaceId,
        target_asset_id: context.assetId,
        target_actor_id: context.actorId,
        target_link_id: context.linkId,
      });
      if (error) throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected project snapshot could not be queued safely.");
      return parseSnapshotEnqueue(data);
    },
    loadContinuation: async (input) => {
      const { data, error } = await admin.rpc("get_connected_project_snapshot_continuation", {
        target_snapshot_task_id: input.snapshotTaskId,
        target_snapshot_id: input.snapshotId,
      });
      if (error) throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected project continuation could not be loaded safely.");
      return parseContinuation(data);
    },
    markWaitingForScanRuntime: async (context) => {
      const { error } = await admin.rpc("mark_connected_project_scan_waiting", {
        target_snapshot_task_id: context.snapshotTaskId,
        target_snapshot_id: context.snapshotId,
      });
      if (error) throw failure("PROJECT_SCAN_PERSIST_FAILED", "Connected project waiting state could not be recorded safely.");
    },
    enqueueScanContinuation: async (context) => {
      const { data, error } = await admin.rpc("enqueue_connected_project_scan_continuation", {
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

  let repository: GitHubRepositorySummary;
  try {
    repository = await deps.revalidateRepository(context);
  } catch (error) {
    if (error instanceof ProjectScanError) throw error;
    throw failure("PROJECT_SCAN_PROVIDER_FAILED", "GitHub repository access could not be verified safely.");
  }
  assertProviderIdentity(context, repository);

  if (repository.isPrivate) return { status: "private_acquisition_required" };
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
  if (context.isPrivate || context.accessStatus !== "active") return { status: "ignored" };

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
