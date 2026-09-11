import { createGitHubAppJwt } from "./jwt";
import {
  GitHubProviderError,
  type GitHubAppConfig,
  type GitHubInstallationSummary,
  type GitHubInstallationToken,
  type GitHubRepositoryPage,
  type GitHubRepositorySummary,
  type GitHubUserToken,
} from "./types";

const GITHUB_API = "https://api.github.com";
const OAUTH_ENDPOINT = "https://github.com/login/oauth/access_token";
const REQUEST_TIMEOUT_MS = 8_000;
const COMMIT_SHA_PATTERN = /^[a-f0-9]{40}$/;
const MAX_ARCHIVE_LOCATION_BYTES = 4_096;

function providerFailure(): GitHubProviderError {
  return new GitHubProviderError("GITHUB_PROVIDER_REQUEST_FAILED", "GitHub provider request failed.");
}

function invalidInput(): GitHubProviderError {
  return new GitHubProviderError("GITHUB_PROVIDER_INPUT_INVALID", "GitHub provider request is invalid.");
}

function positiveSafeInteger(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw invalidInput();
  return value;
}

function boundedPage(value: number): number {
  if (!Number.isFinite(value)) throw invalidInput();
  return Math.min(1000, Math.max(1, Math.floor(value)));
}

function githubHeaders(token: string): Record<string, string> {
  if (!token || token.length > 4096) throw invalidInput();
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2026-03-10",
    "User-Agent": "ScopeForge",
  };
}

async function providerJson(
  url: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  try {
    const response = await fetchImpl(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw providerFailure();
    return await response.json();
  } catch (error) {
    if (error instanceof GitHubProviderError) throw error;
    throw providerFailure();
  }
}

async function providerRedirectLocation(
  url: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<string> {
  try {
    const response = await fetchImpl(url, {
      ...init,
      redirect: "manual",
      signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status !== 302) throw providerFailure();
    const location = response.headers.get("location");
    if (!location || new TextEncoder().encode(location).byteLength > MAX_ARCHIVE_LOCATION_BYTES) {
      throw providerFailure();
    }
    return location;
  } catch (error) {
    if (error instanceof GitHubProviderError) throw error;
    throw providerFailure();
  }
}

function stringField(value: unknown, maximum: number): string | null {
  return typeof value === "string" && value.length >= 1 && value.length <= maximum ? value : null;
}

function repositorySegment(value: string): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > 100
    || value.includes("/")
    || value.includes("\\")
    || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw invalidInput();
  }
  return encodeURIComponent(value);
}

function repositoryRef(value: string): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > 512
    || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw invalidInput();
  }
  return encodeURIComponent(value);
}

function commitSha(value: string): string {
  if (typeof value !== "string" || !COMMIT_SHA_PATTERN.test(value)) throw invalidInput();
  return value;
}

function installationFromProvider(value: unknown): GitHubInstallationSummary {
  if (!value || typeof value !== "object") throw providerFailure();
  const row = value as Record<string, unknown>;
  const account = row.account && typeof row.account === "object" ? row.account as Record<string, unknown> : null;
  const id = typeof row.id === "number" ? row.id : NaN;
  const accountId = typeof account?.id === "number" ? account.id : NaN;
  const accountLogin = stringField(account?.login, 100);
  const accountType = account?.type;
  const repositorySelection = row.repository_selection;
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(accountId) || accountId <= 0 || !accountLogin) {
    throw providerFailure();
  }
  if (accountType !== "User" && accountType !== "Organization") throw providerFailure();
  if (repositorySelection !== "all" && repositorySelection !== "selected") throw providerFailure();
  return Object.freeze({ id, accountId, accountLogin, accountType, repositorySelection });
}

function repositoryFromProvider(value: unknown): GitHubRepositorySummary {
  if (!value || typeof value !== "object") throw providerFailure();
  const row = value as Record<string, unknown>;
  const owner = row.owner && typeof row.owner === "object" ? row.owner as Record<string, unknown> : null;
  const id = typeof row.id === "number" ? row.id : NaN;
  const ownerLogin = stringField(owner?.login, 100);
  const name = stringField(row.name, 100);
  const fullName = stringField(row.full_name, 201);
  const defaultBranch = stringField(row.default_branch, 255);
  const htmlUrl = stringField(row.html_url, 500);
  if (
    !Number.isSafeInteger(id)
    || id <= 0
    || !ownerLogin
    || !name
    || !fullName
    || !defaultBranch
    || !htmlUrl
    || typeof row.private !== "boolean"
    || typeof row.archived !== "boolean"
  ) {
    throw providerFailure();
  }
  if (fullName !== `${ownerLogin}/${name}` || htmlUrl !== `https://github.com/${fullName}`) throw providerFailure();
  return Object.freeze({
    id,
    ownerLogin,
    name,
    fullName,
    defaultBranch,
    isPrivate: row.private,
    isArchived: row.archived,
    htmlUrl,
  });
}

export async function exchangeGitHubUserCode(
  code: string,
  config: GitHubAppConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<GitHubUserToken> {
  const normalizedCode = code.trim();
  if (!normalizedCode || normalizedCode.length > 512) throw invalidInput();
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: normalizedCode,
  });
  const payload = await providerJson(OAUTH_ENDPOINT, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body,
  }, fetchImpl);
  if (!payload || typeof payload !== "object") throw providerFailure();
  const row = payload as Record<string, unknown>;
  const accessToken = stringField(row.access_token, 4096);
  if (!accessToken || row.token_type !== "bearer") throw providerFailure();
  return Object.freeze({ accessToken, tokenType: "bearer" });
}

export async function listUserInstallations(
  userToken: GitHubUserToken,
  fetchImpl: typeof fetch = fetch,
): Promise<GitHubInstallationSummary[]> {
  const payload = await providerJson(`${GITHUB_API}/user/installations?per_page=100&page=1`, {
    method: "GET",
    headers: githubHeaders(userToken.accessToken),
  }, fetchImpl);
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as Record<string, unknown>).installations)) {
    throw providerFailure();
  }
  return (payload as { installations: unknown[] }).installations.slice(0, 100).map(installationFromProvider);
}

export async function getAppInstallation(
  installationId: number,
  config: GitHubAppConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<GitHubInstallationSummary> {
  const id = positiveSafeInteger(installationId);
  const payload = await providerJson(`${GITHUB_API}/app/installations/${id}`, {
    method: "GET",
    headers: githubHeaders(createGitHubAppJwt(config)),
  }, fetchImpl);
  return installationFromProvider(payload);
}

export async function createInstallationToken(
  installationId: number,
  config: GitHubAppConfig,
  options: { repositoryId?: number } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<GitHubInstallationToken> {
  const id = positiveSafeInteger(installationId);
  const request: { repository_ids?: number[]; permissions: { contents: "read"; metadata: "read" } } = {
    permissions: { contents: "read", metadata: "read" },
  };
  if (options.repositoryId !== undefined) request.repository_ids = [positiveSafeInteger(options.repositoryId)];

  const payload = await providerJson(`${GITHUB_API}/app/installations/${id}/access_tokens`, {
    method: "POST",
    headers: { ...githubHeaders(createGitHubAppJwt(config)), "Content-Type": "application/json" },
    body: JSON.stringify(request),
  }, fetchImpl);
  if (!payload || typeof payload !== "object") throw providerFailure();
  const row = payload as Record<string, unknown>;
  const token = stringField(row.token, 4096);
  const expiresAt = stringField(row.expires_at, 64);
  if (!token || !expiresAt || !Number.isFinite(Date.parse(expiresAt))) throw providerFailure();
  return Object.freeze({ token, expiresAt });
}

export async function listInstallationRepositories(
  token: string,
  page = 1,
  fetchImpl: typeof fetch = fetch,
): Promise<GitHubRepositoryPage> {
  const normalizedPage = boundedPage(page);
  const payload = await providerJson(`${GITHUB_API}/installation/repositories?per_page=100&page=${normalizedPage}`, {
    method: "GET",
    headers: githubHeaders(token),
  }, fetchImpl);
  if (!payload || typeof payload !== "object") throw providerFailure();
  const row = payload as Record<string, unknown>;
  if (!Array.isArray(row.repositories) || typeof row.total_count !== "number" || !Number.isFinite(row.total_count) || row.total_count < 0) {
    throw providerFailure();
  }
  const repositories = row.repositories.slice(0, 100).map(repositoryFromProvider);
  return Object.freeze({
    repositories,
    page: normalizedPage,
    hasNextPage: normalizedPage * 100 < row.total_count,
  });
}

export async function getInstallationRepository(
  token: string,
  repositoryId: number,
  fetchImpl: typeof fetch = fetch,
): Promise<GitHubRepositorySummary> {
  const id = positiveSafeInteger(repositoryId);
  const payload = await providerJson(`${GITHUB_API}/repositories/${id}`, {
    method: "GET",
    headers: githubHeaders(token),
  }, fetchImpl);
  return repositoryFromProvider(payload);
}

export async function resolveInstallationRepositoryCommitSha(
  token: string,
  owner: string,
  repository: string,
  ref: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const payload = await providerJson(
    `${GITHUB_API}/repos/${repositorySegment(owner)}/${repositorySegment(repository)}/commits/${repositoryRef(ref)}`,
    { method: "GET", headers: githubHeaders(token) },
    fetchImpl,
  );
  if (!payload || typeof payload !== "object") throw providerFailure();
  const sha = (payload as Record<string, unknown>).sha;
  if (typeof sha !== "string" || !COMMIT_SHA_PATTERN.test(sha)) throw providerFailure();
  return sha;
}

export async function getInstallationDefaultBranchHead(
  token: string,
  repository: GitHubRepositorySummary,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  return resolveInstallationRepositoryCommitSha(
    token,
    repository.ownerLogin,
    repository.name,
    repository.defaultBranch,
    fetchImpl,
  );
}

export async function getInstallationRepositoryArchiveRedirect(
  token: string,
  owner: string,
  repository: string,
  resolvedCommitSha: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  return providerRedirectLocation(
    `${GITHUB_API}/repos/${repositorySegment(owner)}/${repositorySegment(repository)}/tarball/${commitSha(resolvedCommitSha)}`,
    { method: "GET", headers: githubHeaders(token) },
    fetchImpl,
  );
}
