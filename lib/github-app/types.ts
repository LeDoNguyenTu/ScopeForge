export interface GitHubAppConfig {
  appId: string;
  clientId: string;
  clientSecret: string;
  privateKey: string;
  slug: string;
  stateSecret: string;
}

export interface GitHubConnectionState {
  version: 1;
  workspaceId: string;
  userId: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}

export interface GitHubUserToken {
  accessToken: string;
  tokenType: "bearer";
}

export interface GitHubInstallationSummary {
  id: number;
  accountId: number;
  accountLogin: string;
  accountType: "User" | "Organization";
  repositorySelection: "all" | "selected";
}

export interface GitHubInstallationToken {
  token: string;
  expiresAt: string;
}

export interface GitHubRepositorySummary {
  id: number;
  ownerLogin: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  htmlUrl: string;
}

export interface GitHubRepositoryPage {
  repositories: GitHubRepositorySummary[];
  page: number;
  hasNextPage: boolean;
}

export type GitHubProviderErrorCode =
  | "GITHUB_PROVIDER_REQUEST_FAILED"
  | "GITHUB_PROVIDER_INPUT_INVALID";

export class GitHubProviderError extends Error {
  constructor(public readonly code: GitHubProviderErrorCode, message: string) {
    super(message);
    this.name = "GitHubProviderError";
  }
}
