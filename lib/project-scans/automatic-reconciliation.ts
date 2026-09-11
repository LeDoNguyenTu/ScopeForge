import type { Phase10a3Database } from "@/lib/database.phase10a3.types";
import {
  createInstallationToken,
  getInstallationDefaultBranchHead,
  getInstallationRepository,
} from "@/lib/github-app/client";
import { getGitHubAppConfig } from "@/lib/github-app/config";
import type {
  GitHubAppConfig,
  GitHubInstallationToken,
  GitHubRepositorySummary,
} from "@/lib/github-app/types";
import {
  HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED,
  HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED,
} from "@/lib/repository-snapshots/runtime";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AutomaticProjectScanCompletionContext,
  AutomaticProjectScanReconciliationResult,
} from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMMIT_SHA_PATTERN = /^[a-f0-9]{40}$/;

type PushHeadResult = {
  replayed: boolean;
  shouldEnqueue: boolean;
  ignored: boolean;
  desiredCommitSha: string;
};

type AutomaticSnapshotEnqueueResult = {
  replayed: boolean;
  taskId: string | null;
  desiredCommitSha: string;
};

type AutomaticFollowUpContext = Omit<
  AutomaticProjectScanCompletionContext,
  "followUpRequired" | "desiredCommitSha" | "successfulCommitSha"
> & {
  followUpRequired: true;
  desiredCommitSha: string;
  successfulCommitSha: string | null;
};

type ManualTerminalSettlement =
  | { matched: true; replayed: false; followUpRequired: false }
  | AutomaticFollowUpContext;

export interface AutomaticProjectScanReconciliationDependencies {
  completeAutomaticProjectScan(input: {
    snapshotTaskId: string;
    snapshotId: string;
  }): Promise<unknown>;
  settleManualProjectScanTerminal(input: {
    scanTaskId: string;
  }): Promise<unknown>;
  getConfig(): GitHubAppConfig;
  createInstallationToken(
    installationId: number,
    config: GitHubAppConfig,
    options: { repositoryId: number },
  ): Promise<GitHubInstallationToken>;
  getInstallationRepository(token: string, repositoryId: number): Promise<GitHubRepositorySummary>;
  getDefaultBranchHead(token: string, repository: GitHubRepositorySummary): Promise<string>;
  recordPushHead(input: {
    workspaceId: string;
    linkId: string;
    repositoryId: number;
    deliveryId: string;
    commitSha: string;
  }): Promise<PushHeadResult>;
  enqueueProjectSnapshot(input: {
    workspaceId: string;
    linkId: string;
    deliveryId: string;
    commitSha: string;
  }): Promise<AutomaticSnapshotEnqueueResult>;
  publicSnapshotRuntimeEnabled(): boolean;
  privateSnapshotRuntimeEnabled(): boolean;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function uuid(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function commitSha(value: unknown): string | null {
  return typeof value === "string" && COMMIT_SHA_PATTERN.test(value) ? value : null;
}

function boundedString(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length >= 1 && value.length <= max ? value : null;
}

function parseFollowUpContext(
  row: Record<string, unknown>,
  successfulCommitShaRequired: boolean,
): AutomaticFollowUpContext {
  const workspaceId = uuid(row.workspaceId);
  const linkId = uuid(row.linkId);
  const installationId = positiveInteger(row.installationId);
  const repositoryId = positiveInteger(row.repositoryId);
  const latestDeliveryId = uuid(row.latestDeliveryId);
  const defaultBranch = boundedString(row.defaultBranch, 255);
  const htmlUrl = boundedString(row.htmlUrl, 512);
  const desiredCommitSha = commitSha(row.desiredCommitSha);
  const successfulCommitSha = row.successfulCommitSha === null
    ? null
    : commitSha(row.successfulCommitSha);
  const accessStatus = row.accessStatus;

  if (
    !workspaceId || !linkId || !installationId || !repositoryId || !latestDeliveryId
    || !defaultBranch || !htmlUrl || !desiredCommitSha
    || (successfulCommitShaRequired && !successfulCommitSha)
    || (row.successfulCommitSha !== null && !successfulCommitSha)
    || typeof row.isPrivate !== "boolean"
    || typeof row.autoScanEnabled !== "boolean"
    || typeof row.providerArchived !== "boolean"
    || (accessStatus !== "active" && accessStatus !== "inaccessible" && accessStatus !== "removed")
  ) {
    throw new Error("AUTOMATIC_PROJECT_SCAN_COMPLETION_INVALID");
  }

  return {
    matched: true,
    replayed: false,
    followUpRequired: true,
    workspaceId,
    linkId,
    installationId,
    repositoryId,
    latestDeliveryId,
    defaultBranch,
    isPrivate: row.isPrivate,
    htmlUrl,
    accessStatus,
    autoScanEnabled: row.autoScanEnabled,
    providerArchived: row.providerArchived,
    desiredCommitSha,
    successfulCommitSha,
  };
}

function parseCompletion(value: unknown): AutomaticProjectScanCompletionContext | null {
  const row = objectValue(value);
  if (!row) return null;
  if (row.matched === false) return null;
  if (row.matched !== true || row.replayed !== false || typeof row.followUpRequired !== "boolean") {
    throw new Error("AUTOMATIC_PROJECT_SCAN_COMPLETION_INVALID");
  }

  if (row.followUpRequired) {
    return parseFollowUpContext(row, true) as AutomaticProjectScanCompletionContext;
  }

  const successfulCommitSha = commitSha(row.successfulCommitSha);
  if (!successfulCommitSha) throw new Error("AUTOMATIC_PROJECT_SCAN_COMPLETION_INVALID");

  const workspaceId = uuid(row.workspaceId);
  const linkId = uuid(row.linkId);
  const installationId = positiveInteger(row.installationId);
  const repositoryId = positiveInteger(row.repositoryId);
  const latestDeliveryId = uuid(row.latestDeliveryId);
  const defaultBranch = boundedString(row.defaultBranch, 255);
  const htmlUrl = boundedString(row.htmlUrl, 512);
  const desiredCommitSha = row.desiredCommitSha === null ? null : commitSha(row.desiredCommitSha);
  const accessStatus = row.accessStatus;
  if (
    !workspaceId || !linkId || !installationId || !repositoryId || !latestDeliveryId
    || !defaultBranch || !htmlUrl
    || (row.desiredCommitSha !== null && !desiredCommitSha)
    || typeof row.isPrivate !== "boolean"
    || typeof row.autoScanEnabled !== "boolean"
    || typeof row.providerArchived !== "boolean"
    || (accessStatus !== "active" && accessStatus !== "inaccessible" && accessStatus !== "removed")
  ) {
    throw new Error("AUTOMATIC_PROJECT_SCAN_COMPLETION_INVALID");
  }

  return {
    matched: true,
    replayed: false,
    followUpRequired: false,
    workspaceId,
    linkId,
    installationId,
    repositoryId,
    latestDeliveryId,
    defaultBranch,
    isPrivate: row.isPrivate,
    htmlUrl,
    accessStatus,
    autoScanEnabled: row.autoScanEnabled,
    providerArchived: row.providerArchived,
    desiredCommitSha,
    successfulCommitSha,
  };
}

function parseManualTerminalSettlement(value: unknown): ManualTerminalSettlement | null {
  const row = objectValue(value);
  if (!row) return null;
  if (row.matched === false) return null;
  if (row.matched !== true || row.replayed !== false || typeof row.followUpRequired !== "boolean") {
    throw new Error("MANUAL_PROJECT_SCAN_TERMINAL_INVALID");
  }
  if (!row.followUpRequired) {
    return { matched: true, replayed: false, followUpRequired: false };
  }
  return parseFollowUpContext(row, false);
}

function parsePushHead(value: unknown): PushHeadResult {
  const row = objectValue(value);
  const desiredCommitSha = commitSha(row?.desiredCommitSha);
  if (
    !row || typeof row.replayed !== "boolean" || typeof row.shouldEnqueue !== "boolean"
    || typeof row.ignored !== "boolean" || !desiredCommitSha
  ) {
    throw new Error("AUTOMATIC_PROJECT_SCAN_PUSH_HEAD_INVALID");
  }
  return {
    replayed: row.replayed,
    shouldEnqueue: row.shouldEnqueue,
    ignored: row.ignored,
    desiredCommitSha,
  };
}

function parseAutomaticSnapshotEnqueue(value: unknown): AutomaticSnapshotEnqueueResult {
  const row = objectValue(value);
  const desiredCommitSha = commitSha(row?.desiredCommitSha);
  const taskId = row?.taskId === undefined || row.taskId === null ? null : uuid(row.taskId);
  if (!row || typeof row.replayed !== "boolean" || !desiredCommitSha) {
    throw new Error("AUTOMATIC_PROJECT_SCAN_ENQUEUE_INVALID");
  }
  if (!row.replayed && !taskId) {
    throw new Error("AUTOMATIC_PROJECT_SCAN_ENQUEUE_INVALID");
  }
  return { replayed: row.replayed, taskId, desiredCommitSha };
}

function createDefaultDependencies(): AutomaticProjectScanReconciliationDependencies {
  const admin = createAdminClient<Phase10a3Database>();
  return {
    completeAutomaticProjectScan: async (input) => {
      const { data, error } = await admin.rpc("complete_github_webhook_project_scan", {
        target_snapshot_task_id: input.snapshotTaskId,
        target_snapshot_id: input.snapshotId,
      });
      if (error) throw new Error("AUTOMATIC_PROJECT_SCAN_COMPLETION_FAILED");
      return data;
    },
    settleManualProjectScanTerminal: async (input) => {
      const { data, error } = await admin.rpc("settle_manual_connected_project_scan_terminal", {
        target_scan_task_id: input.scanTaskId,
      });
      if (error) throw new Error("MANUAL_PROJECT_SCAN_TERMINAL_FAILED");
      return data;
    },
    getConfig: getGitHubAppConfig,
    createInstallationToken: (installationId, config, options) =>
      createInstallationToken(installationId, config, options),
    getInstallationRepository: (token, repositoryId) =>
      getInstallationRepository(token, repositoryId),
    getDefaultBranchHead: (token, repository) =>
      getInstallationDefaultBranchHead(token, repository),
    recordPushHead: async (input) => {
      const { data, error } = await admin.rpc("record_github_webhook_push_head", {
        target_workspace_id: input.workspaceId,
        target_link_id: input.linkId,
        target_repository_id: input.repositoryId,
        target_delivery_id: input.deliveryId,
        target_commit_sha: input.commitSha,
      });
      if (error) throw new Error("AUTOMATIC_PROJECT_SCAN_PUSH_HEAD_FAILED");
      return parsePushHead(data);
    },
    enqueueProjectSnapshot: async (input) => {
      const { data, error } = await admin.rpc("enqueue_github_webhook_project_snapshot", {
        target_workspace_id: input.workspaceId,
        target_link_id: input.linkId,
        target_delivery_id: input.deliveryId,
        target_commit_sha: input.commitSha,
      });
      if (error) throw new Error("AUTOMATIC_PROJECT_SCAN_ENQUEUE_FAILED");
      return parseAutomaticSnapshotEnqueue(data);
    },
    publicSnapshotRuntimeEnabled: () => HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED,
    privateSnapshotRuntimeEnabled: () => HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED,
  };
}

function eligibleForFollowUp(context: AutomaticFollowUpContext): boolean {
  return context.accessStatus === "active"
    && context.autoScanEnabled
    && !context.providerArchived;
}

function providerIdentityMatches(
  context: AutomaticFollowUpContext,
  repository: GitHubRepositorySummary,
): boolean {
  return repository.id === context.repositoryId
    && repository.htmlUrl === context.htmlUrl
    && repository.isPrivate === context.isPrivate
    && repository.defaultBranch === context.defaultBranch
    && !repository.isArchived;
}

async function scheduleAutomaticFollowUp(
  context: AutomaticFollowUpContext,
  deps: AutomaticProjectScanReconciliationDependencies,
): Promise<AutomaticProjectScanReconciliationResult> {
  if (!eligibleForFollowUp(context)) {
    return { status: "pending", code: "INELIGIBLE" };
  }

  if (context.isPrivate) {
    if (!deps.privateSnapshotRuntimeEnabled()) {
      return { status: "runtime_unavailable", code: "PRIVATE_SNAPSHOT_RUNTIME_UNAVAILABLE" };
    }
  } else if (!deps.publicSnapshotRuntimeEnabled()) {
    return { status: "runtime_unavailable", code: "PUBLIC_SNAPSHOT_RUNTIME_UNAVAILABLE" };
  }

  let repository: GitHubRepositorySummary;
  let authoritativeHead: string;
  try {
    const config = deps.getConfig();
    const token = await deps.createInstallationToken(
      context.installationId,
      config,
      { repositoryId: context.repositoryId },
    );
    repository = await deps.getInstallationRepository(token.token, context.repositoryId);
    if (!providerIdentityMatches(context, repository)) {
      return { status: "pending", code: "PROVIDER_STATE_CHANGED" };
    }
    authoritativeHead = await deps.getDefaultBranchHead(token.token, repository);
    if (!COMMIT_SHA_PATTERN.test(authoritativeHead)) {
      return { status: "pending", code: "PROVIDER_UNAVAILABLE" };
    }
  } catch {
    return { status: "pending", code: "PROVIDER_UNAVAILABLE" };
  }

  if (authoritativeHead !== context.desiredCommitSha) {
    let refreshed: PushHeadResult;
    try {
      refreshed = await deps.recordPushHead({
        workspaceId: context.workspaceId,
        linkId: context.linkId,
        repositoryId: context.repositoryId,
        deliveryId: context.latestDeliveryId,
        commitSha: authoritativeHead,
      });
    } catch {
      return { status: "pending", code: "ENQUEUE_DEFERRED" };
    }
    if (refreshed.ignored) return { status: "pending", code: "INELIGIBLE" };
    if (!refreshed.shouldEnqueue) {
      if (context.successfulCommitSha && authoritativeHead === context.successfulCommitSha) {
        return { status: "completed", successfulCommitSha: context.successfulCommitSha };
      }
      return { status: "pending", code: "COALESCED" };
    }
  }

  let queued: AutomaticSnapshotEnqueueResult;
  try {
    queued = await deps.enqueueProjectSnapshot({
      workspaceId: context.workspaceId,
      linkId: context.linkId,
      deliveryId: context.latestDeliveryId,
      commitSha: authoritativeHead,
    });
  } catch {
    return { status: "pending", code: "ENQUEUE_DEFERRED" };
  }

  if (queued.replayed || !queued.taskId) {
    if (context.successfulCommitSha && authoritativeHead === context.successfulCommitSha) {
      return { status: "completed", successfulCommitSha: context.successfulCommitSha };
    }
    return { status: "pending", code: "COALESCED" };
  }
  return {
    status: "follow_up_queued",
    taskId: queued.taskId,
    commitSha: authoritativeHead,
  };
}

export async function reconcileAutomaticProjectScanAfterSnapshot(
  input: { snapshotTaskId: string; snapshotId: string },
  dependencies?: AutomaticProjectScanReconciliationDependencies,
): Promise<AutomaticProjectScanReconciliationResult> {
  if (!UUID_PATTERN.test(input.snapshotTaskId) || !UUID_PATTERN.test(input.snapshotId)) {
    return { status: "ignored" };
  }

  const deps = dependencies ?? createDefaultDependencies();
  let completion: AutomaticProjectScanCompletionContext | null;
  try {
    completion = parseCompletion(await deps.completeAutomaticProjectScan(input));
  } catch {
    return { status: "pending", code: "ENQUEUE_DEFERRED" };
  }
  if (!completion) return { status: "ignored" };

  if (!completion.followUpRequired) {
    return { status: "completed", successfulCommitSha: completion.successfulCommitSha };
  }
  return scheduleAutomaticFollowUp(completion as AutomaticFollowUpContext, deps);
}

export async function reconcilePendingAutomaticProjectScanAfterRepositoryScanTerminal(
  input: { scanTaskId: string },
  dependencies?: AutomaticProjectScanReconciliationDependencies,
): Promise<AutomaticProjectScanReconciliationResult> {
  if (!UUID_PATTERN.test(input.scanTaskId)) return { status: "ignored" };

  const deps = dependencies ?? createDefaultDependencies();
  let settlement: ManualTerminalSettlement | null;
  try {
    settlement = parseManualTerminalSettlement(await deps.settleManualProjectScanTerminal(input));
  } catch {
    return { status: "pending", code: "ENQUEUE_DEFERRED" };
  }
  if (!settlement || !settlement.followUpRequired) return { status: "ignored" };
  return scheduleAutomaticFollowUp(settlement, deps);
}
