import type { WorkspaceRole } from "@/lib/database.types";
import type { Phase10a1Database } from "@/lib/database.phase10a1.types";
import { writeAuditEvent } from "@/lib/audit/write-audit-event";
import { normalizeAssetTarget } from "@/lib/assets/normalize-target";
import { assertCanRegisterAsset, QuotaError } from "@/lib/quotas/limits";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  createInstallationToken,
  getInstallationRepository,
  listInstallationRepositories,
} from "./client";
import { getGitHubAppConfig } from "./config";
import type { GitHubConnectionRecord } from "./authorization";
import type {
  GitHubAppConfig,
  GitHubInstallationToken,
  GitHubRepositoryPage,
  GitHubRepositorySummary,
} from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REPOSITORY_PAGE = 1000;
const MAX_REPOSITORIES_PER_PAGE = 100;

export type GitHubRepositoryServiceErrorCode =
  | "GITHUB_REPOSITORY_UNAUTHENTICATED"
  | "GITHUB_REPOSITORY_FORBIDDEN"
  | "GITHUB_REPOSITORY_INPUT_INVALID"
  | "GITHUB_CONNECTION_MISSING"
  | "GITHUB_CONNECTION_INACTIVE"
  | "GITHUB_REPOSITORY_PROVIDER_FAILED"
  | "GITHUB_REPOSITORY_SCOPE_MISMATCH"
  | "GITHUB_REPOSITORY_ASSET_CONFLICT"
  | "GITHUB_REPOSITORY_PERSIST_FAILED"
  | "ASSET_LIMIT_REACHED";

export class GitHubRepositoryServiceError extends Error {
  constructor(
    public readonly code: GitHubRepositoryServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GitHubRepositoryServiceError";
  }
}

export interface GitHubRepositoryActor {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
}

export interface GitHubRepositoryAssetRecord {
  id: string;
  workspaceId: string;
  canonicalTarget: string;
  kind: "web_application" | "api" | "repository";
}

export interface GitHubRepositoryLinkRecord {
  id: string;
  workspaceId: string;
  githubConnectionId: string;
  assetId: string;
  repositoryId: number;
  ownerLogin: string;
  repositoryName: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  htmlUrl: string;
  autoScanEnabled: boolean;
  accessStatus: "active" | "inaccessible" | "removed";
  createdAt: string;
  updatedAt: string;
}

export interface GitHubRepositoryLinkInput {
  workspaceId: string;
  githubConnectionId: string;
  assetId: string;
  repositoryId: number;
  ownerLogin: string;
  repositoryName: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  htmlUrl: string;
}

export interface GitHubRepositoryAuditInput {
  workspaceId: string;
  actorId: string;
  eventType: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface GitHubRepositoryServiceDependencies {
  authorizeWorkspace(workspaceId: string): Promise<GitHubRepositoryActor>;
  loadConnection(workspaceId: string): Promise<GitHubConnectionRecord | null>;
  getConfig(): GitHubAppConfig;
  createInstallationToken(
    installationId: number,
    config: GitHubAppConfig,
    options: { repositoryId?: number },
  ): Promise<GitHubInstallationToken>;
  listInstallationRepositories(token: string, page: number): Promise<GitHubRepositoryPage>;
  getInstallationRepository(token: string, repositoryId: number): Promise<GitHubRepositorySummary>;
  findAsset(workspaceId: string, canonicalTarget: string): Promise<GitHubRepositoryAssetRecord | null>;
  countAssets(workspaceId: string): Promise<number>;
  createVerifiedAsset(input: {
    workspaceId: string;
    canonicalTarget: string;
    name: string;
    verifiedBy: string;
    verifiedAt: Date;
  }): Promise<GitHubRepositoryAssetRecord>;
  markAssetVerified(
    asset: GitHubRepositoryAssetRecord,
    verifiedBy: string,
    verifiedAt: Date,
  ): Promise<GitHubRepositoryAssetRecord>;
  findRepositoryLinkByRepository(workspaceId: string, repositoryId: number): Promise<GitHubRepositoryLinkRecord | null>;
  findRepositoryLinkByAsset(workspaceId: string, assetId: string): Promise<GitHubRepositoryLinkRecord | null>;
  upsertRepositoryLink(input: GitHubRepositoryLinkInput): Promise<GitHubRepositoryLinkRecord>;
  writeAudit(input: GitHubRepositoryAuditInput): Promise<void>;
  now(): Date;
}

function failure(code: GitHubRepositoryServiceErrorCode, message: string): GitHubRepositoryServiceError {
  return new GitHubRepositoryServiceError(code, message);
}

function validWorkspaceId(value: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw failure("GITHUB_REPOSITORY_INPUT_INVALID", "Workspace selection is invalid.");
  }
  return value;
}

function validRepositoryId(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw failure("GITHUB_REPOSITORY_INPUT_INVALID", "GitHub repository selection is invalid.");
  }
  return value;
}

function validPage(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > MAX_REPOSITORY_PAGE) {
    throw failure("GITHUB_REPOSITORY_INPUT_INVALID", "GitHub repository page is invalid.");
  }
  return value;
}

function requireOwnerOrAdmin(actor: GitHubRepositoryActor, workspaceId: string): GitHubRepositoryActor {
  if (actor.workspaceId !== workspaceId) {
    throw failure("GITHUB_REPOSITORY_SCOPE_MISMATCH", "Workspace authorization does not match the requested workspace.");
  }
  if (actor.role !== "owner" && actor.role !== "admin") {
    throw failure("GITHUB_REPOSITORY_FORBIDDEN", "Workspace owner or admin access is required.");
  }
  return actor;
}

function requireActiveConnection(connection: GitHubConnectionRecord | null, workspaceId: string): GitHubConnectionRecord {
  if (!connection) {
    throw failure("GITHUB_CONNECTION_MISSING", "Connect GitHub before importing repositories.");
  }
  if (connection.workspaceId !== workspaceId) {
    throw failure("GITHUB_REPOSITORY_SCOPE_MISMATCH", "GitHub connection does not belong to this workspace.");
  }
  if (connection.status !== "active") {
    throw failure("GITHUB_CONNECTION_INACTIVE", "The GitHub connection is not active.");
  }
  return connection;
}

function safeRepository(value: GitHubRepositorySummary): GitHubRepositorySummary {
  if (
    !Number.isSafeInteger(value.id)
    || value.id <= 0
    || !value.ownerLogin
    || value.ownerLogin.length > 100
    || !value.name
    || value.name.length > 100
    || value.fullName !== `${value.ownerLogin}/${value.name}`
    || !value.defaultBranch
    || value.defaultBranch.length > 255
    || typeof value.isPrivate !== "boolean"
    || typeof value.isArchived !== "boolean"
    || value.htmlUrl !== `https://github.com/${value.fullName}`
  ) {
    throw failure("GITHUB_REPOSITORY_PROVIDER_FAILED", "GitHub returned invalid repository metadata.");
  }
  return Object.freeze({
    id: value.id,
    ownerLogin: value.ownerLogin,
    name: value.name,
    fullName: value.fullName,
    defaultBranch: value.defaultBranch,
    isPrivate: value.isPrivate,
    isArchived: value.isArchived,
    htmlUrl: value.htmlUrl,
  });
}

function mapConnectionRow(data: Phase10a1Database["public"]["Tables"]["github_connections"]["Row"]): GitHubConnectionRecord {
  return {
    id: data.id,
    workspaceId: data.workspace_id,
    installationId: data.installation_id,
    accountId: data.account_id,
    accountLogin: data.account_login,
    accountType: data.account_type,
    repositorySelection: data.repository_selection,
    status: data.status,
    installedBy: data.installed_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

type GitHubRepositoryAssetRow = Pick<
  Phase10a1Database["public"]["Tables"]["assets"]["Row"],
  "id" | "workspace_id" | "canonical_target" | "kind"
>;

function mapAssetRow(data: GitHubRepositoryAssetRow): GitHubRepositoryAssetRecord {
  return {
    id: data.id,
    workspaceId: data.workspace_id,
    canonicalTarget: data.canonical_target,
    kind: data.kind,
  };
}

function mapLinkRow(data: Phase10a1Database["public"]["Tables"]["github_repository_links"]["Row"]): GitHubRepositoryLinkRecord {
  return {
    id: data.id,
    workspaceId: data.workspace_id,
    githubConnectionId: data.github_connection_id,
    assetId: data.asset_id,
    repositoryId: data.repository_id,
    ownerLogin: data.owner_login,
    repositoryName: data.repository_name,
    fullName: data.full_name,
    defaultBranch: data.default_branch,
    isPrivate: data.is_private,
    htmlUrl: data.html_url,
    autoScanEnabled: data.auto_scan_enabled,
    accessStatus: data.access_status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function createDefaultDependencies(): GitHubRepositoryServiceDependencies {
  const admin = createAdminClient<Phase10a1Database>();
  const auditAdmin = createAdminClient();

  return {
    authorizeWorkspace: async (workspaceId) => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw failure("GITHUB_REPOSITORY_UNAUTHENTICATED", "Sign in to manage GitHub repositories.");
      }
      const { data, error } = await supabase
        .from("workspace_members")
        .select("workspace_id,role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error || !data) {
        throw failure("GITHUB_REPOSITORY_FORBIDDEN", "Workspace access is required.");
      }
      return { userId: user.id, workspaceId: data.workspace_id, role: data.role };
    },
    loadConnection: async (workspaceId) => {
      const { data, error } = await admin
        .from("github_connections")
        .select("id,workspace_id,installation_id,account_id,account_login,account_type,repository_selection,status,installed_by,created_at,updated_at")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (error) throw failure("GITHUB_REPOSITORY_PERSIST_FAILED", "GitHub connection could not be loaded safely.");
      return data ? mapConnectionRow(data) : null;
    },
    getConfig: getGitHubAppConfig,
    createInstallationToken: (installationId, config, options) => createInstallationToken(installationId, config, options),
    listInstallationRepositories: (token, page) => listInstallationRepositories(token, page),
    getInstallationRepository: (token, repositoryId) => getInstallationRepository(token, repositoryId),
    findAsset: async (workspaceId, canonicalTarget) => {
      const { data, error } = await admin
        .from("assets")
        .select("id,workspace_id,canonical_target,kind")
        .eq("workspace_id", workspaceId)
        .eq("canonical_target", canonicalTarget)
        .maybeSingle();
      if (error) throw failure("GITHUB_REPOSITORY_PERSIST_FAILED", "Repository asset could not be loaded safely.");
      return data ? mapAssetRow(data) : null;
    },
    countAssets: async (workspaceId) => {
      const { count, error } = await admin
        .from("assets")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId);
      if (error) throw failure("GITHUB_REPOSITORY_PERSIST_FAILED", "Workspace asset quota could not be checked safely.");
      return count ?? 0;
    },
    createVerifiedAsset: async (input) => {
      const { data, error } = await admin
        .from("assets")
        .insert({
          workspace_id: input.workspaceId,
          kind: "repository",
          name: input.name,
          canonical_target: input.canonicalTarget,
          hostname: "github.com",
          verification_status: "verified",
          verified_at: input.verifiedAt.toISOString(),
          verified_by: input.verifiedBy,
          created_by: input.verifiedBy,
        })
        .select("id,workspace_id,canonical_target,kind")
        .single();
      if (error || !data) {
        if (error?.message.includes("ASSET_LIMIT_REACHED")) {
          throw failure("ASSET_LIMIT_REACHED", "This trial workspace can register up to 10 assets.");
        }
        throw failure("GITHUB_REPOSITORY_PERSIST_FAILED", "Repository asset could not be created safely.");
      }
      return mapAssetRow(data);
    },
    markAssetVerified: async (asset, verifiedBy, verifiedAt) => {
      const { data, error } = await admin
        .from("assets")
        .update({
          verification_status: "verified",
          verified_at: verifiedAt.toISOString(),
          verified_by: verifiedBy,
        })
        .eq("id", asset.id)
        .eq("workspace_id", asset.workspaceId)
        .select("id,workspace_id,canonical_target,kind")
        .single();
      if (error || !data) {
        throw failure("GITHUB_REPOSITORY_PERSIST_FAILED", "Repository verification state could not be saved safely.");
      }
      return mapAssetRow(data);
    },
    findRepositoryLinkByRepository: async (workspaceId, repositoryId) => {
      const { data, error } = await admin
        .from("github_repository_links")
        .select("id,workspace_id,github_connection_id,asset_id,repository_id,owner_login,repository_name,full_name,default_branch,is_private,html_url,auto_scan_enabled,access_status,created_at,updated_at")
        .eq("workspace_id", workspaceId)
        .eq("repository_id", repositoryId)
        .maybeSingle();
      if (error) throw failure("GITHUB_REPOSITORY_PERSIST_FAILED", "Repository link could not be loaded safely.");
      return data ? mapLinkRow(data) : null;
    },
    findRepositoryLinkByAsset: async (workspaceId, assetId) => {
      const { data, error } = await admin
        .from("github_repository_links")
        .select("id,workspace_id,github_connection_id,asset_id,repository_id,owner_login,repository_name,full_name,default_branch,is_private,html_url,auto_scan_enabled,access_status,created_at,updated_at")
        .eq("workspace_id", workspaceId)
        .eq("asset_id", assetId)
        .maybeSingle();
      if (error) throw failure("GITHUB_REPOSITORY_PERSIST_FAILED", "Repository link could not be loaded safely.");
      return data ? mapLinkRow(data) : null;
    },
    upsertRepositoryLink: async (input) => {
      const { data, error } = await admin
        .from("github_repository_links")
        .upsert({
          workspace_id: input.workspaceId,
          github_connection_id: input.githubConnectionId,
          asset_id: input.assetId,
          repository_id: input.repositoryId,
          owner_login: input.ownerLogin,
          repository_name: input.repositoryName,
          full_name: input.fullName,
          default_branch: input.defaultBranch,
          is_private: input.isPrivate,
          html_url: input.htmlUrl,
          access_status: "active",
        }, { onConflict: "workspace_id,repository_id" })
        .select("id,workspace_id,github_connection_id,asset_id,repository_id,owner_login,repository_name,full_name,default_branch,is_private,html_url,auto_scan_enabled,access_status,created_at,updated_at")
        .single();
      if (error || !data) {
        throw failure("GITHUB_REPOSITORY_PERSIST_FAILED", "Repository link could not be saved safely.");
      }
      return mapLinkRow(data);
    },
    writeAudit: async (input) => writeAuditEvent({
      supabase: auditAdmin,
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      eventType: input.eventType,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata,
    }),
    now: () => new Date(),
  };
}

async function authorizedConnection(
  workspaceId: string,
  deps: GitHubRepositoryServiceDependencies,
): Promise<{ actor: GitHubRepositoryActor; connection: GitHubConnectionRecord }> {
  const actor = requireOwnerOrAdmin(await deps.authorizeWorkspace(workspaceId), workspaceId);
  const connection = requireActiveConnection(await deps.loadConnection(workspaceId), workspaceId);
  return { actor, connection };
}

export async function listConnectedRepositories(
  input: { workspaceId: string; page: number },
  dependencies?: GitHubRepositoryServiceDependencies,
): Promise<GitHubRepositoryPage> {
  const workspaceId = validWorkspaceId(input.workspaceId);
  const page = validPage(input.page);
  const deps = dependencies ?? createDefaultDependencies();
  const { connection } = await authorizedConnection(workspaceId, deps);

  try {
    const installationToken = await deps.createInstallationToken(
      connection.installationId,
      deps.getConfig(),
      {},
    );
    const providerPage = await deps.listInstallationRepositories(installationToken.token, page);
    if (
      providerPage.page !== page
      || typeof providerPage.hasNextPage !== "boolean"
      || providerPage.repositories.length > MAX_REPOSITORIES_PER_PAGE
    ) {
      throw failure("GITHUB_REPOSITORY_PROVIDER_FAILED", "GitHub returned an invalid repository page.");
    }
    return Object.freeze({
      repositories: providerPage.repositories.map(safeRepository),
      page,
      hasNextPage: providerPage.hasNextPage,
    });
  } catch (error) {
    if (error instanceof GitHubRepositoryServiceError) throw error;
    throw failure("GITHUB_REPOSITORY_PROVIDER_FAILED", "GitHub repositories could not be loaded safely.");
  }
}

export async function importGitHubRepository(
  input: { workspaceId: string; repositoryId: number },
  dependencies?: GitHubRepositoryServiceDependencies,
): Promise<{ assetId: string; linkId: string; publicAcquisitionEligible: boolean }> {
  const workspaceId = validWorkspaceId(input.workspaceId);
  const repositoryId = validRepositoryId(input.repositoryId);
  const deps = dependencies ?? createDefaultDependencies();
  const { actor, connection } = await authorizedConnection(workspaceId, deps);

  let repository: GitHubRepositorySummary;
  try {
    const installationToken = await deps.createInstallationToken(
      connection.installationId,
      deps.getConfig(),
      { repositoryId },
    );
    repository = safeRepository(await deps.getInstallationRepository(installationToken.token, repositoryId));
    if (repository.id !== repositoryId) {
      throw failure("GITHUB_REPOSITORY_PROVIDER_FAILED", "GitHub repository identity did not match the requested repository.");
    }
  } catch (error) {
    if (error instanceof GitHubRepositoryServiceError) throw error;
    throw failure("GITHUB_REPOSITORY_PROVIDER_FAILED", "GitHub repository access could not be verified safely.");
  }

  const normalized = normalizeAssetTarget(repository.htmlUrl, "repository");
  if (normalized.canonicalTarget !== repository.htmlUrl) {
    throw failure("GITHUB_REPOSITORY_PROVIDER_FAILED", "GitHub repository identity could not be canonicalized safely.");
  }

  const existingLink = await deps.findRepositoryLinkByRepository(workspaceId, repositoryId);
  if (existingLink && (
    existingLink.workspaceId !== workspaceId
    || existingLink.repositoryId !== repositoryId
    || existingLink.githubConnectionId !== connection.id
  )) {
    throw failure("GITHUB_REPOSITORY_SCOPE_MISMATCH", "Existing GitHub repository linkage does not match this workspace connection.");
  }

  await deps.writeAudit({
    workspaceId,
    actorId: actor.userId,
    eventType: "github.repository_import_started",
    targetType: "github_connection",
    targetId: connection.id,
    metadata: {
      repositoryId,
      private: repository.isPrivate,
    },
  });

  let asset = await deps.findAsset(workspaceId, normalized.canonicalTarget);
  if (asset) {
    if (
      asset.workspaceId !== workspaceId
      || asset.canonicalTarget !== normalized.canonicalTarget
      || asset.kind !== "repository"
    ) {
      throw failure("GITHUB_REPOSITORY_SCOPE_MISMATCH", "Existing repository asset does not match the authorized workspace target.");
    }
    asset = await deps.markAssetVerified(asset, actor.userId, deps.now());
  } else {
    if (existingLink) {
      throw failure("GITHUB_REPOSITORY_ASSET_CONFLICT", "The GitHub repository is linked to a different repository target.");
    }
    try {
      assertCanRegisterAsset(await deps.countAssets(workspaceId));
    } catch (error) {
      if (error instanceof QuotaError) {
        throw failure("ASSET_LIMIT_REACHED", error.message);
      }
      throw error;
    }
    asset = await deps.createVerifiedAsset({
      workspaceId,
      canonicalTarget: normalized.canonicalTarget,
      name: repository.name,
      verifiedBy: actor.userId,
      verifiedAt: deps.now(),
    });
  }

  if (
    asset.workspaceId !== workspaceId
    || asset.canonicalTarget !== normalized.canonicalTarget
    || asset.kind !== "repository"
  ) {
    throw failure("GITHUB_REPOSITORY_SCOPE_MISMATCH", "Repository asset persistence crossed the authorized workspace boundary.");
  }

  if (existingLink && existingLink.assetId !== asset.id) {
    throw failure("GITHUB_REPOSITORY_ASSET_CONFLICT", "The GitHub repository is already linked to another asset.");
  }
  const assetLink = await deps.findRepositoryLinkByAsset(workspaceId, asset.id);
  if (assetLink && assetLink.repositoryId !== repositoryId) {
    throw failure("GITHUB_REPOSITORY_ASSET_CONFLICT", "This repository asset is already linked to another GitHub repository.");
  }

  const link = await deps.upsertRepositoryLink({
    workspaceId,
    githubConnectionId: connection.id,
    assetId: asset.id,
    repositoryId,
    ownerLogin: repository.ownerLogin,
    repositoryName: repository.name,
    fullName: repository.fullName,
    defaultBranch: repository.defaultBranch,
    isPrivate: repository.isPrivate,
    htmlUrl: repository.htmlUrl,
  });

  if (
    link.workspaceId !== workspaceId
    || link.assetId !== asset.id
    || link.repositoryId !== repositoryId
    || link.githubConnectionId !== connection.id
  ) {
    throw failure("GITHUB_REPOSITORY_SCOPE_MISMATCH", "Saved GitHub repository linkage does not match the authorized project.");
  }

  await deps.writeAudit({
    workspaceId,
    actorId: actor.userId,
    eventType: "github.repository_linked",
    targetType: "asset",
    targetId: asset.id,
    metadata: {
      repositoryId,
      private: repository.isPrivate,
      defaultBranch: repository.defaultBranch,
      publicAcquisitionEligible: !repository.isPrivate,
    },
  });

  return {
    assetId: asset.id,
    linkId: link.id,
    publicAcquisitionEligible: !repository.isPrivate,
  };
}