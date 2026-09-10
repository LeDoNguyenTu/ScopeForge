import { randomBytes } from "node:crypto";
import type { WorkspaceRole } from "@/lib/database.types";
import type { Phase10a1Database } from "@/lib/database.phase10a1.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { exchangeGitHubUserCode, listUserInstallations } from "./client";
import { getGitHubAppConfig } from "./config";
import { createGitHubConnectionState, verifyGitHubConnectionState } from "./state";
import type {
  GitHubAppConfig,
  GitHubInstallationSummary,
  GitHubUserToken,
} from "./types";

export type GitHubConnectionAuthorizationErrorCode =
  | "GITHUB_CONNECTION_UNAUTHENTICATED"
  | "GITHUB_CONNECTION_FORBIDDEN"
  | "GITHUB_CONNECTION_STATE_INVALID"
  | "GITHUB_CONNECTION_STATE_MISMATCH"
  | "GITHUB_CONNECTION_INPUT_INVALID"
  | "GITHUB_INSTALLATION_NOT_AUTHORIZED"
  | "GITHUB_CONNECTION_PROVIDER_FAILED"
  | "GITHUB_CONNECTION_PERSIST_FAILED";

export class GitHubConnectionAuthorizationError extends Error {
  constructor(
    public readonly code: GitHubConnectionAuthorizationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GitHubConnectionAuthorizationError";
  }
}

export interface GitHubConnectionActor {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
}

export interface GitHubConnectionRecord {
  id: string;
  workspaceId: string;
  installationId: number;
  accountId: number;
  accountLogin: string;
  accountType: "User" | "Organization";
  repositorySelection: "all" | "selected";
  status: "active" | "suspended" | "removed";
  installedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubConnectionPersistenceInput {
  workspaceId: string;
  installationId: number;
  accountId: number;
  accountLogin: string;
  accountType: "User" | "Organization";
  repositorySelection: "all" | "selected";
  installedBy: string;
}

export interface GitHubConnectionAuthorizationDependencies {
  getConfig(): GitHubAppConfig;
  authorizeWorkspace(workspaceId?: string): Promise<GitHubConnectionActor>;
  createNonce(): string;
  now(): Date;
  exchangeUserCode(code: string, config: GitHubAppConfig): Promise<GitHubUserToken>;
  listUserInstallations(userToken: GitHubUserToken): Promise<GitHubInstallationSummary[]>;
  upsertConnection(input: GitHubConnectionPersistenceInput): Promise<GitHubConnectionRecord>;
}

function failure(
  code: GitHubConnectionAuthorizationErrorCode,
  message: string,
): GitHubConnectionAuthorizationError {
  return new GitHubConnectionAuthorizationError(code, message);
}

function requireOwnerOrAdmin(actor: GitHubConnectionActor): GitHubConnectionActor {
  if (actor.role !== "owner" && actor.role !== "admin") {
    throw failure("GITHUB_CONNECTION_FORBIDDEN", "Workspace owner or admin access is required.");
  }
  return actor;
}

function positiveInstallationId(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw failure("GITHUB_CONNECTION_INPUT_INVALID", "GitHub installation selection is invalid.");
  }
  return value;
}

function validCode(value: string): string {
  const code = value.trim();
  if (!code || code.length > 512) {
    throw failure("GITHUB_CONNECTION_INPUT_INVALID", "GitHub authorization response is invalid.");
  }
  return code;
}

function createDefaultDependencies(): GitHubConnectionAuthorizationDependencies {
  return {
    getConfig: getGitHubAppConfig,
    authorizeWorkspace: async (workspaceId) => {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw failure("GITHUB_CONNECTION_UNAUTHENTICATED", "Sign in to connect GitHub.");
      }

      let query = supabase
        .from("workspace_members")
        .select("workspace_id,role")
        .eq("user_id", user.id);
      if (workspaceId) query = query.eq("workspace_id", workspaceId);
      const { data, error } = workspaceId
        ? await query.maybeSingle()
        : await query.order("joined_at", { ascending: true }).limit(1).maybeSingle();
      if (error || !data) {
        throw failure("GITHUB_CONNECTION_FORBIDDEN", "Workspace access is required.");
      }
      return {
        userId: user.id,
        workspaceId: data.workspace_id,
        role: data.role,
      };
    },
    createNonce: () => randomBytes(24).toString("base64url"),
    now: () => new Date(),
    exchangeUserCode: exchangeGitHubUserCode,
    listUserInstallations,
    upsertConnection: async (input) => {
      const admin = createAdminClient<Phase10a1Database>();
      const { data, error } = await admin
        .from("github_connections")
        .upsert({
          workspace_id: input.workspaceId,
          installation_id: input.installationId,
          account_id: input.accountId,
          account_login: input.accountLogin,
          account_type: input.accountType,
          repository_selection: input.repositorySelection,
          status: "active",
          installed_by: input.installedBy,
        }, { onConflict: "workspace_id" })
        .select("id,workspace_id,installation_id,account_id,account_login,account_type,repository_selection,status,installed_by,created_at,updated_at")
        .single();
      if (error || !data) {
        throw failure("GITHUB_CONNECTION_PERSIST_FAILED", "GitHub connection could not be saved safely.");
      }
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
    },
  };
}

function verifiedState(
  value: string,
  config: GitHubAppConfig,
  now: Date,
) {
  try {
    return verifyGitHubConnectionState(value, config.stateSecret, now);
  } catch {
    throw failure("GITHUB_CONNECTION_STATE_INVALID", "GitHub connection state is invalid or expired.");
  }
}

async function authorizeState(
  stateValue: string,
  deps: GitHubConnectionAuthorizationDependencies,
) {
  const config = deps.getConfig();
  const state = verifiedState(stateValue, config, deps.now());
  const actor = requireOwnerOrAdmin(await deps.authorizeWorkspace(state.workspaceId));
  if (actor.userId !== state.userId || actor.workspaceId !== state.workspaceId) {
    throw failure("GITHUB_CONNECTION_STATE_MISMATCH", "GitHub connection state does not match the current session.");
  }
  return { config, state, actor };
}

export async function beginGitHubConnection(
  dependencies?: GitHubConnectionAuthorizationDependencies,
): Promise<URL> {
  const deps = dependencies ?? createDefaultDependencies();
  const actor = requireOwnerOrAdmin(await deps.authorizeWorkspace());
  const config = deps.getConfig();
  const state = createGitHubConnectionState(
    {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      nonce: deps.createNonce(),
    },
    config.stateSecret,
    deps.now(),
  );
  const url = new URL(`https://github.com/apps/${config.slug}/installations/new`);
  url.searchParams.set("state", state);
  return url;
}

export async function prepareGitHubUserAuthorization(
  input: { state: string; installationId: number },
  dependencies?: GitHubConnectionAuthorizationDependencies,
): Promise<{ installationId: number; authorizationUrl: URL }> {
  const deps = dependencies ?? createDefaultDependencies();
  const { config } = await authorizeState(input.state, deps);
  const installationId = positiveInstallationId(input.installationId);
  const authorizationUrl = new URL("https://github.com/login/oauth/authorize");
  authorizationUrl.searchParams.set("client_id", config.clientId);
  authorizationUrl.searchParams.set("state", input.state);
  authorizationUrl.searchParams.set("prompt", "select_account");
  return { installationId, authorizationUrl };
}

export async function completeGitHubConnection(
  input: { state: string; code: string; installationId: number },
  dependencies?: GitHubConnectionAuthorizationDependencies,
): Promise<GitHubConnectionRecord> {
  const deps = dependencies ?? createDefaultDependencies();
  const { config, actor } = await authorizeState(input.state, deps);
  const installationId = positiveInstallationId(input.installationId);
  const code = validCode(input.code);

  try {
    const userToken = await deps.exchangeUserCode(code, config);
    const installations = await deps.listUserInstallations(userToken);
    const installation = installations.find((candidate) => candidate.id === installationId);
    if (!installation) {
      throw failure(
        "GITHUB_INSTALLATION_NOT_AUTHORIZED",
        "The selected GitHub installation is not available to the authorized GitHub user.",
      );
    }

    return await deps.upsertConnection({
      workspaceId: actor.workspaceId,
      installationId: installation.id,
      accountId: installation.accountId,
      accountLogin: installation.accountLogin,
      accountType: installation.accountType,
      repositorySelection: installation.repositorySelection,
      installedBy: actor.userId,
    });
  } catch (error) {
    if (error instanceof GitHubConnectionAuthorizationError) throw error;
    throw failure("GITHUB_CONNECTION_PROVIDER_FAILED", "GitHub connection could not be verified safely.");
  }
}
