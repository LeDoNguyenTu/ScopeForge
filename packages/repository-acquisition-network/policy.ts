import { isIP } from "node:net";

export const GITHUB_API_HOST = "api.github.com" as const;
export const GITHUB_ARCHIVE_HOST = "codeload.github.com" as const;
export const GITHUB_ACQUISITION_USER_AGENT = "ScopeForge-RepositoryAcquirer/0.1" as const;
export const GITHUB_API_VERSION = "2026-03-10" as const;

const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,98}[A-Za-z0-9])?$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;

export type GitHubNetworkTarget = "api" | "archive";

export function assertGitHubOwnerName(value: string): string {
  if (!OWNER_PATTERN.test(value)) throw new Error("GitHub owner identity is invalid.");
  return value;
}

export function assertGitHubRepositoryName(value: string): string {
  if (!REPOSITORY_PATTERN.test(value)) throw new Error("GitHub repository identity is invalid.");
  return value;
}

export function assertGitHubDefaultBranch(value: string): string {
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes < 1 || bytes > 255 || /[\u0000-\u001f\u007f\\]/.test(value)) {
    throw new Error("GitHub default branch is invalid.");
  }
  return value;
}

export function assertGitHubCommitSha(value: string): string {
  if (!COMMIT_PATTERN.test(value)) throw new Error("GitHub commit SHA is invalid.");
  return value;
}

export function assertGitHubNetworkUrl(url: URL, target: GitHubNetworkTarget): void {
  if (url.protocol !== "https:") throw new Error("GitHub acquisition requires HTTPS.");
  if (url.username || url.password) throw new Error("GitHub acquisition rejects URL credentials.");
  if (url.hash) throw new Error("GitHub acquisition rejects URL fragments.");
  if (url.port && url.port !== "443") throw new Error("GitHub acquisition permits port 443 only.");
  if (isIP(url.hostname) !== 0) throw new Error("GitHub acquisition rejects IP-literal hosts.");

  const expectedHost = target === "api" ? GITHUB_API_HOST : GITHUB_ARCHIVE_HOST;
  if (url.hostname.toLowerCase() !== expectedHost) {
    throw new Error("GitHub acquisition rejected an unreviewed host.");
  }
}

export function githubRepositoryUrl(owner: string, repository: string): string {
  return `https://github.com/${assertGitHubOwnerName(owner)}/${assertGitHubRepositoryName(repository)}`;
}

export function githubRepositoryApiUrl(owner: string, repository: string): URL {
  return new URL(
    `https://${GITHUB_API_HOST}/repos/${encodeURIComponent(assertGitHubOwnerName(owner))}/${encodeURIComponent(assertGitHubRepositoryName(repository))}`,
  );
}

export function githubCommitApiUrl(owner: string, repository: string, branch: string): URL {
  const base = githubRepositoryApiUrl(owner, repository);
  base.pathname += `/commits/${encodeURIComponent(assertGitHubDefaultBranch(branch))}`;
  return base;
}

export function githubTarballApiUrl(owner: string, repository: string, commitSha: string): URL {
  const base = githubRepositoryApiUrl(owner, repository);
  base.pathname += `/tarball/${assertGitHubCommitSha(commitSha)}`;
  return base;
}
