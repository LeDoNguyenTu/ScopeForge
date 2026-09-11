import type { Phase10a3Database } from "@/lib/database.phase10a3.types";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED,
  HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED,
} from "@/lib/repository-snapshots/runtime";
import {
  createInstallationToken,
  getInstallationDefaultBranchHead,
  getInstallationRepository,
} from "./client";
import { getGitHubAppConfig } from "./config";
import type {
  GitHubAppConfig,
  GitHubInstallationToken,
  GitHubRepositorySummary,
} from "./types";
import type { VerifiedGitHubWebhookRequest } from "./webhook";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMMIT_SHA_PATTERN = /^[a-f0-9]{40}$/;
const ZERO_COMMIT_SHA = "0".repeat(40);
const MAX_PUSH_REF_LENGTH = 512;

export type GitHubWebhookResult =
  | { status: "accepted"; code: "PING" }
  | { status: "ignored"; code: string }
  | { status: "replayed"; code: "DELIVERY_REPLAY" | "SEMANTIC_REPLAY" }
  | {
      status: "queued";
      taskId: string;
      executionClass: "repository_snapshot_github_public_v1" | "repository_snapshot_github_private_v1";
    }
  | { status: "pending"; code: "COALESCED" | "ENQUEUE_REPLAY" }
  | { status: "superseded"; code: "AUTHORITATIVE_HEAD_ADVANCED" }
  | {
      status: "runtime_unavailable";
      code: "PUBLIC_SNAPSHOT_RUNTIME_UNAVAILABLE" | "PRIVATE_SNAPSHOT_RUNTIME_UNAVAILABLE";
    };

export type GitHubWebhookConnectionStatus = "active" | "suspended" | "removed";
export type GitHubWebhookRepositoryAccessStatus = "active" | "inaccessible" | "removed";
export type GitHubWebhookDeliveryState = "processed" | "ignored" | "failed";

export interface GitHubWebhookRepositoryContext {
  workspaceId: string;
  connectionId: string;
  linkId: string;
  assetId: string;
  installationId: number;
  repositoryId: number;
  installedBy: string;
  connectionStatus: GitHubWebhookConnectionStatus;
  accessStatus: GitHubWebhookRepositoryAccessStatus;
  autoScanEnabled: boolean;
  ownerLogin: string;
  repositoryName: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  htmlUrl: string;
  providerArchived: boolean;
  desiredCommitSha: string | null;
  successfulCommitSha: string | null;
  pending: boolean;
}

export interface GitHubWebhookRepositoryReconciliationInput {
  installationId: number;
  repositoryId: number;
  ownerLogin: string;
  repositoryName: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  htmlUrl: string;
  providerArchived: boolean;
  accessStatus: GitHubWebhookRepositoryAccessStatus;
}

export interface GitHubWebhookPushHeadInput {
  workspaceId: string;
  linkId: string;
  repositoryId: number;
  deliveryId: string;
  commitSha: string;
}

export interface GitHubWebhookSnapshotEnqueueInput {
  workspaceId: string;
  linkId: string;
  deliveryId: string;
  commitSha: string;
}

export interface GitHubWebhookServiceDependencies {
  getConfig(): GitHubAppConfig;
  admitDelivery(input: {
    deliveryId: string;
    eventName: string;
    action: string | null;
    installationId: number | null;
    repositoryId: number | null;
    pushAfterSha: string | null;
  }): Promise<{ admitted: boolean; replayed: boolean }>;
  loadRepositoryContext(
    installationId: number,
    repositoryId: number,
  ): Promise<GitHubWebhookRepositoryContext | null>;
  createInstallationToken(
    installationId: number,
    config: GitHubAppConfig,
    options: { repositoryId: number },
  ): Promise<GitHubInstallationToken>;
  getInstallationRepository(token: string, repositoryId: number): Promise<GitHubRepositorySummary>;
  getDefaultBranchHead(token: string, repository: GitHubRepositorySummary): Promise<string>;
  reconcileRepository(input: GitHubWebhookRepositoryReconciliationInput): Promise<{ matched: boolean }>;
  recordPushHead(input: GitHubWebhookPushHeadInput): Promise<{
    replayed: boolean;
    shouldEnqueue: boolean;
    coalesced: boolean;
    ignored: boolean;
    desiredCommitSha: string;
  }>;
  publicSnapshotRuntimeEnabled(): boolean;
  privateSnapshotRuntimeEnabled(): boolean;
  enqueueProjectSnapshot(input: GitHubWebhookSnapshotEnqueueInput): Promise<{
    replayed: boolean;
    taskId?: string;
    scanJobId?: string;
    executionClass?: "repository_snapshot_github_public_v1" | "repository_snapshot_github_private_v1";
    desiredCommitSha: string;
  }>;
  recordDeliveryResult(
    deliveryId: string,
    state: GitHubWebhookDeliveryState,
    resultCode: string | null,
  ): Promise<void>;
}

export class GitHubWebhookServiceError extends Error {
  public readonly code = "GITHUB_WEBHOOK_PROCESSING_FAILED" as const;

  constructor() {
    super("GitHub webhook could not be processed safely.");
    this.name = "GitHubWebhookServiceError";
  }
}

interface PushCandidate {
  installationId: number;
  repositoryId: number;
  ref: string;
  after: string;
  deleted: boolean;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

function uuidValue(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

function commitSha(value: unknown): string | null {
  return typeof value === "string" && COMMIT_SHA_PATTERN.test(value) ? value : null;
}

function optionalCommitSha(value: unknown): string | null | undefined {
  if (value === null) return null;
  const parsed = commitSha(value);
  return parsed ?? undefined;
}

function boundedString(value: unknown, maximum: number): string | null {
  return typeof value === "string" && value.length >= 1 && value.length <= maximum
    ? value
    : null;
}

function connectionStatus(value: unknown): GitHubWebhookConnectionStatus | null {
  return value === "active" || value === "suspended" || value === "removed" ? value : null;
}

function accessStatus(value: unknown): GitHubWebhookRepositoryAccessStatus | null {
  return value === "active" || value === "inaccessible" || value === "removed" ? value : null;
}

function parsePushCandidate(payload: Record<string, unknown>): PushCandidate | null {
  const installation = objectValue(payload.installation);
  const repository = objectValue(payload.repository);
  const installationId = positiveInteger(installation?.id);
  const repositoryId = positiveInteger(repository?.id);
  const ref = boundedString(payload.ref, MAX_PUSH_REF_LENGTH);
  const after = commitSha(payload.after);
  const deleted = payload.deleted;

  if (!installationId || !repositoryId || !ref || !after || typeof deleted !== "boolean") {
    return null;
  }

  return { installationId, repositoryId, ref, after, deleted };
}

function parseRepositoryContext(value: unknown): GitHubWebhookRepositoryContext | null {
  if (value === null) return null;
  const row = objectValue(value);
  const workspaceId = uuidValue(row?.workspaceId);
  const connectionId = uuidValue(row?.connectionId);
  const linkId = uuidValue(row?.linkId);
  const assetId = uuidValue(row?.assetId);
  const installationId = positiveInteger(row?.installationId);
  const repositoryId = positiveInteger(row?.repositoryId);
  const installedBy = uuidValue(row?.installedBy);
  const parsedConnectionStatus = connectionStatus(row?.connectionStatus);
  const parsedAccessStatus = accessStatus(row?.accessStatus);
  const ownerLogin = boundedString(row?.ownerLogin, 100);
  const repositoryName = boundedString(row?.repositoryName, 100);
  const fullName = boundedString(row?.fullName, 201);
  const defaultBranch = boundedString(row?.defaultBranch, 255);
  const htmlUrl = boundedString(row?.htmlUrl, 500);
  const desiredCommitSha = optionalCommitSha(row?.desiredCommitSha);
  const successfulCommitSha = optionalCommitSha(row?.successfulCommitSha);

  if (
    !workspaceId || !connectionId || !linkId || !assetId || !installationId || !repositoryId || !installedBy
    || !parsedConnectionStatus || !parsedAccessStatus || !ownerLogin || !repositoryName || !fullName
    || !defaultBranch || !htmlUrl
    || typeof row?.autoScanEnabled !== "boolean"
    || typeof row?.isPrivate !== "boolean"
    || typeof row?.providerArchived !== "boolean"
    || typeof row?.pending !== "boolean"
    || desiredCommitSha === undefined
    || successfulCommitSha === undefined
    || fullName !== `${ownerLogin}/${repositoryName}`
    || htmlUrl !== `https://github.com/${fullName}`
  ) {
    throw new GitHubWebhookServiceError();
  }

  return {
    workspaceId,
    connectionId,
    linkId,
    assetId,
    installationId,
    repositoryId,
    installedBy,
    connectionStatus: parsedConnectionStatus,
    accessStatus: parsedAccessStatus,
    autoScanEnabled: row.autoScanEnabled,
    ownerLogin,
    repositoryName,
    fullName,
    defaultBranch,
    isPrivate: row.isPrivate,
    htmlUrl,
    providerArchived: row.providerArchived,
    desiredCommitSha,
    successfulCommitSha,
    pending: row.pending,
  };
}

function parseAdmission(value: unknown): { admitted: boolean; replayed: boolean } {
  const row = objectValue(value);
  if (typeof row?.admitted !== "boolean" || typeof row?.replayed !== "boolean") {
    throw new GitHubWebhookServiceError();
  }
  if (row.admitted === row.replayed) throw new GitHubWebhookServiceError();
  return { admitted: row.admitted, replayed: row.replayed };
}

function parseReconciliation(value: unknown): { matched: boolean } {
  const row = objectValue(value);
  if (typeof row?.matched !== "boolean") throw new GitHubWebhookServiceError();
  return { matched: row.matched };
}

function parsePushHead(value: unknown): {
  replayed: boolean;
  shouldEnqueue: boolean;
  coalesced: boolean;
  ignored: boolean;
  desiredCommitSha: string;
} {
  const row = objectValue(value);
  const desiredCommitSha = commitSha(row?.desiredCommitSha);
  if (
    typeof row?.replayed !== "boolean"
    || typeof row?.shouldEnqueue !== "boolean"
    || typeof row?.ignored !== "boolean"
    || !desiredCommitSha
  ) {
    throw new GitHubWebhookServiceError();
  }
  const coalesced = row.coalesced === undefined ? false : row.coalesced;
  if (typeof coalesced !== "boolean") throw new GitHubWebhookServiceError();
  if (row.shouldEnqueue && (row.replayed || row.ignored || coalesced)) {
    throw new GitHubWebhookServiceError();
  }
  return {
    replayed: row.replayed,
    shouldEnqueue: row.shouldEnqueue,
    coalesced,
    ignored: row.ignored,
    desiredCommitSha,
  };
}

function executionClass(value: unknown):
  | "repository_snapshot_github_public_v1"
  | "repository_snapshot_github_private_v1"
  | null {
  return value === "repository_snapshot_github_public_v1" || value === "repository_snapshot_github_private_v1"
    ? value
    : null;
}

function parseSnapshotEnqueue(value: unknown): {
  replayed: boolean;
  taskId?: string;
  scanJobId?: string;
  executionClass?: "repository_snapshot_github_public_v1" | "repository_snapshot_github_private_v1";
  desiredCommitSha: string;
} {
  const row = objectValue(value);
  const desiredCommitSha = commitSha(row?.desiredCommitSha);
  if (typeof row?.replayed !== "boolean" || !desiredCommitSha) {
    throw new GitHubWebhookServiceError();
  }

  const taskId = row.taskId === undefined ? undefined : uuidValue(row.taskId) ?? undefined;
  const scanJobId = row.scanJobId === undefined ? undefined : uuidValue(row.scanJobId) ?? undefined;
  const parsedExecutionClass = row.executionClass === undefined ? undefined : executionClass(row.executionClass) ?? undefined;

  if (!row.replayed && (!taskId || !scanJobId || !parsedExecutionClass)) {
    throw new GitHubWebhookServiceError();
  }
  if (row.taskId !== undefined && !taskId) throw new GitHubWebhookServiceError();
  if (row.scanJobId !== undefined && !scanJobId) throw new GitHubWebhookServiceError();
  if (row.executionClass !== undefined && !parsedExecutionClass) throw new GitHubWebhookServiceError();

  return {
    replayed: row.replayed,
    ...(taskId ? { taskId } : {}),
    ...(scanJobId ? { scanJobId } : {}),
    ...(parsedExecutionClass ? { executionClass: parsedExecutionClass } : {}),
    desiredCommitSha,
  };
}

function createDefaultDependencies(): GitHubWebhookServiceDependencies {
  const admin = createAdminClient<Phase10a3Database>();

  return {
    getConfig: getGitHubAppConfig,
    admitDelivery: async (input) => {
      const { data, error } = await admin.rpc("admit_github_webhook_delivery", {
        target_delivery_id: input.deliveryId,
        target_event_name: input.eventName,
        target_action: input.action,
        target_installation_id: input.installationId,
        target_repository_id: input.repositoryId,
        target_push_after_sha: input.pushAfterSha,
      });
      if (error) throw new GitHubWebhookServiceError();
      return parseAdmission(data);
    },
    loadRepositoryContext: async (installationId, repositoryId) => {
      const { data, error } = await admin.rpc("get_github_webhook_repository_context", {
        target_installation_id: installationId,
        target_repository_id: repositoryId,
      });
      if (error) throw new GitHubWebhookServiceError();
      return parseRepositoryContext(data);
    },
    createInstallationToken: (installationId, config, options) => (
      createInstallationToken(installationId, config, options)
    ),
    getInstallationRepository: (token, repositoryId) => getInstallationRepository(token, repositoryId),
    getDefaultBranchHead: (token, repository) => getInstallationDefaultBranchHead(token, repository),
    reconcileRepository: async (input) => {
      const { data, error } = await admin.rpc("reconcile_github_webhook_repository_state", {
        target_installation_id: input.installationId,
        target_repository_id: input.repositoryId,
        target_owner_login: input.ownerLogin,
        target_repository_name: input.repositoryName,
        target_full_name: input.fullName,
        target_default_branch: input.defaultBranch,
        target_is_private: input.isPrivate,
        target_html_url: input.htmlUrl,
        target_provider_archived: input.providerArchived,
        target_access_status: input.accessStatus,
      });
      if (error) throw new GitHubWebhookServiceError();
      return parseReconciliation(data);
    },
    recordPushHead: async (input) => {
      const { data, error } = await admin.rpc("record_github_webhook_push_head", {
        target_workspace_id: input.workspaceId,
        target_link_id: input.linkId,
        target_repository_id: input.repositoryId,
        target_delivery_id: input.deliveryId,
        target_commit_sha: input.commitSha,
      });
      if (error) throw new GitHubWebhookServiceError();
      return parsePushHead(data);
    },
    publicSnapshotRuntimeEnabled: () => HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED,
    privateSnapshotRuntimeEnabled: () => HOSTED_PRIVATE_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED,
    enqueueProjectSnapshot: async (input) => {
      const { data, error } = await admin.rpc("enqueue_github_webhook_project_snapshot", {
        target_workspace_id: input.workspaceId,
        target_link_id: input.linkId,
        target_delivery_id: input.deliveryId,
        target_commit_sha: input.commitSha,
      });
      if (error) throw new GitHubWebhookServiceError();
      return parseSnapshotEnqueue(data);
    },
    recordDeliveryResult: async (deliveryId, state, resultCode) => {
      const { error } = await admin.rpc("record_github_webhook_delivery_result", {
        target_delivery_id: deliveryId,
        target_state: state,
        target_result_code: resultCode,
      });
      if (error) throw new GitHubWebhookServiceError();
    },
  };
}

async function finish(
  deps: GitHubWebhookServiceDependencies,
  deliveryId: string,
  state: "processed" | "ignored",
  code: string,
  result: GitHubWebhookResult,
): Promise<GitHubWebhookResult> {
  await deps.recordDeliveryResult(deliveryId, state, code);
  return result;
}

function isScannablePush(candidate: PushCandidate | null): candidate is PushCandidate {
  return Boolean(
    candidate
    && candidate.ref.startsWith("refs/heads/")
    && candidate.ref.length > "refs/heads/".length
    && !candidate.deleted
    && candidate.after !== ZERO_COMMIT_SHA,
  );
}

function expectedExecutionClass(repository: GitHubRepositorySummary):
  | "repository_snapshot_github_public_v1"
  | "repository_snapshot_github_private_v1" {
  return repository.isPrivate
    ? "repository_snapshot_github_private_v1"
    : "repository_snapshot_github_public_v1";
}

export async function processGitHubWebhook(
  input: VerifiedGitHubWebhookRequest,
  dependencies?: GitHubWebhookServiceDependencies,
): Promise<GitHubWebhookResult> {
  if (input.event === "ping") {
    return { status: "accepted", code: "PING" };
  }
  if (input.event !== "push") {
    return { status: "ignored", code: "EVENT_UNSUPPORTED" };
  }

  const candidate = parsePushCandidate(input.payload);
  if (!isScannablePush(candidate)) {
    return { status: "ignored", code: "PUSH_NOT_SCANNABLE" };
  }

  const deps = dependencies ?? createDefaultDependencies();
  let admitted = false;

  try {
    const admission = await deps.admitDelivery({
      deliveryId: input.deliveryId,
      eventName: "push",
      action: null,
      installationId: candidate.installationId,
      repositoryId: candidate.repositoryId,
      pushAfterSha: candidate.after,
    });
    if (admission.replayed) {
      return { status: "replayed", code: "DELIVERY_REPLAY" };
    }
    if (!admission.admitted) throw new GitHubWebhookServiceError();
    admitted = true;

    const context = await deps.loadRepositoryContext(candidate.installationId, candidate.repositoryId);
    if (!context) {
      return finish(
        deps,
        input.deliveryId,
        "ignored",
        "REPOSITORY_NOT_CONNECTED",
        { status: "ignored", code: "REPOSITORY_NOT_CONNECTED" },
      );
    }
    if (context.installationId !== candidate.installationId || context.repositoryId !== candidate.repositoryId) {
      throw new GitHubWebhookServiceError();
    }
    if (context.connectionStatus !== "active") {
      return finish(
        deps,
        input.deliveryId,
        "ignored",
        "CONNECTION_INACTIVE",
        { status: "ignored", code: "CONNECTION_INACTIVE" },
      );
    }
    if (context.accessStatus !== "active") {
      return finish(
        deps,
        input.deliveryId,
        "ignored",
        "REPOSITORY_INACTIVE",
        { status: "ignored", code: "REPOSITORY_INACTIVE" },
      );
    }
    if (!context.autoScanEnabled) {
      return finish(
        deps,
        input.deliveryId,
        "ignored",
        "AUTO_SCAN_DISABLED",
        { status: "ignored", code: "AUTO_SCAN_DISABLED" },
      );
    }

    const config = deps.getConfig();
    const installationToken = await deps.createInstallationToken(
      context.installationId,
      config,
      { repositoryId: context.repositoryId },
    );
    const repository = await deps.getInstallationRepository(
      installationToken.token,
      context.repositoryId,
    );
    if (repository.id !== context.repositoryId) throw new GitHubWebhookServiceError();

    const reconciliation = await deps.reconcileRepository({
      installationId: context.installationId,
      repositoryId: context.repositoryId,
      ownerLogin: repository.ownerLogin,
      repositoryName: repository.name,
      fullName: repository.fullName,
      defaultBranch: repository.defaultBranch,
      isPrivate: repository.isPrivate,
      htmlUrl: repository.htmlUrl,
      providerArchived: repository.isArchived,
      accessStatus: "active",
    });
    if (!reconciliation.matched) {
      return finish(
        deps,
        input.deliveryId,
        "ignored",
        "REPOSITORY_NOT_CONNECTED",
        { status: "ignored", code: "REPOSITORY_NOT_CONNECTED" },
      );
    }
    if (repository.isArchived) {
      return finish(
        deps,
        input.deliveryId,
        "ignored",
        "REPOSITORY_ARCHIVED",
        { status: "ignored", code: "REPOSITORY_ARCHIVED" },
      );
    }

    if (candidate.ref !== `refs/heads/${repository.defaultBranch}`) {
      return finish(
        deps,
        input.deliveryId,
        "ignored",
        "NON_DEFAULT_BRANCH",
        { status: "ignored", code: "NON_DEFAULT_BRANCH" },
      );
    }

    const authoritativeHead = await deps.getDefaultBranchHead(installationToken.token, repository);
    if (!COMMIT_SHA_PATTERN.test(authoritativeHead)) throw new GitHubWebhookServiceError();
    if (candidate.after !== authoritativeHead) {
      return finish(
        deps,
        input.deliveryId,
        "processed",
        "AUTHORITATIVE_HEAD_ADVANCED",
        { status: "superseded", code: "AUTHORITATIVE_HEAD_ADVANCED" },
      );
    }

    if (repository.isPrivate) {
      if (!deps.privateSnapshotRuntimeEnabled()) {
        return finish(
          deps,
          input.deliveryId,
          "processed",
          "PRIVATE_SNAPSHOT_RUNTIME_UNAVAILABLE",
          { status: "runtime_unavailable", code: "PRIVATE_SNAPSHOT_RUNTIME_UNAVAILABLE" },
        );
      }
    } else if (!deps.publicSnapshotRuntimeEnabled()) {
      return finish(
        deps,
        input.deliveryId,
        "processed",
        "PUBLIC_SNAPSHOT_RUNTIME_UNAVAILABLE",
        { status: "runtime_unavailable", code: "PUBLIC_SNAPSHOT_RUNTIME_UNAVAILABLE" },
      );
    }

    const pushHead = await deps.recordPushHead({
      workspaceId: context.workspaceId,
      linkId: context.linkId,
      repositoryId: context.repositoryId,
      deliveryId: input.deliveryId,
      commitSha: authoritativeHead,
    });
    if (pushHead.desiredCommitSha !== authoritativeHead) throw new GitHubWebhookServiceError();
    if (pushHead.ignored) {
      return finish(
        deps,
        input.deliveryId,
        "ignored",
        "REPOSITORY_INACTIVE",
        { status: "ignored", code: "REPOSITORY_INACTIVE" },
      );
    }
    if (pushHead.replayed) {
      return finish(
        deps,
        input.deliveryId,
        "processed",
        "SEMANTIC_REPLAY",
        { status: "replayed", code: "SEMANTIC_REPLAY" },
      );
    }
    if (pushHead.coalesced) {
      return finish(
        deps,
        input.deliveryId,
        "processed",
        "COALESCED",
        { status: "pending", code: "COALESCED" },
      );
    }
    if (!pushHead.shouldEnqueue) throw new GitHubWebhookServiceError();

    const enqueue = await deps.enqueueProjectSnapshot({
      workspaceId: context.workspaceId,
      linkId: context.linkId,
      deliveryId: input.deliveryId,
      commitSha: authoritativeHead,
    });
    if (enqueue.desiredCommitSha !== authoritativeHead) throw new GitHubWebhookServiceError();
    if (enqueue.replayed) {
      return finish(
        deps,
        input.deliveryId,
        "processed",
        "ENQUEUE_REPLAY",
        { status: "pending", code: "ENQUEUE_REPLAY" },
      );
    }

    const expectedClass = expectedExecutionClass(repository);
    if (!enqueue.taskId || enqueue.executionClass !== expectedClass) {
      throw new GitHubWebhookServiceError();
    }

    await deps.recordDeliveryResult(input.deliveryId, "processed", "SNAPSHOT_QUEUED");
    return {
      status: "queued",
      taskId: enqueue.taskId,
      executionClass: expectedClass,
    };
  } catch {
    if (admitted) {
      try {
        await deps.recordDeliveryResult(input.deliveryId, "failed", "PROCESSING_FAILED");
      } catch {
        // Best-effort bounded failure recording only. Never expose persistence/provider detail.
      }
    }
    throw new GitHubWebhookServiceError();
  }
}
