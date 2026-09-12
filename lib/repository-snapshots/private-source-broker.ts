import {
  createInstallationToken,
  getInstallationRepository,
  getInstallationRepositoryArchiveRedirect,
  resolveInstallationRepositoryCommitSha,
} from "@/lib/github-app/client";
import type {
  GitHubAppConfig,
  GitHubInstallationToken,
  GitHubRepositorySummary,
} from "@/lib/github-app/types";
import type { GitHubPrivateArchiveLease } from "@/packages/worker-contracts";

const COMMIT_SHA_PATTERN = /^[a-f0-9]{40}$/;
const MAX_REPOSITORY_SEGMENT_BYTES = 100;
const MAX_CANONICAL_URL_BYTES = 512;
const MAX_ARCHIVE_URL_BYTES = 4_096;
const PRIVATE_ARCHIVE_LEASE_TTL_MS = 4 * 60 * 1_000;
const MIN_REMAINING_AUTHORITY_MS = 1_000;

export interface PrivateRepositorySourceClaim {
  installationId: number;
  repositoryId: number;
  owner: string;
  repository: string;
  canonicalRepositoryUrl: string;
  absoluteDeadlineAt: string;
  leaseExpiresAt: string;
}

export interface PrivateRepositorySourceBrokerDependencies {
  config: GitHubAppConfig;
  now?: () => Date;
  createInstallationToken?: (
    installationId: number,
    config: GitHubAppConfig,
    options: { repositoryId: number },
  ) => Promise<GitHubInstallationToken>;
  getInstallationRepository?: (
    token: string,
    repositoryId: number,
  ) => Promise<GitHubRepositorySummary>;
  resolveInstallationRepositoryCommitSha?: (
    token: string,
    owner: string,
    repository: string,
    ref: string,
  ) => Promise<string>;
  getInstallationRepositoryArchiveRedirect?: (
    token: string,
    owner: string,
    repository: string,
    resolvedCommitSha: string,
  ) => Promise<string>;
}

export class PrivateRepositorySourceBrokerError extends Error {
  constructor(
    public readonly code:
      | "PRIVATE_REPOSITORY_SOURCE_INVALID"
      | "PRIVATE_REPOSITORY_SOURCE_UNAVAILABLE"
      | "PRIVATE_REPOSITORY_SOURCE_IDENTITY_MISMATCH"
      | "PRIVATE_REPOSITORY_SOURCE_AUTHORITY_EXPIRED",
    message: string,
  ) {
    super(message);
    this.name = "PrivateRepositorySourceBrokerError";
  }
}

function failure(
  code: PrivateRepositorySourceBrokerError["code"],
  message: string,
): PrivateRepositorySourceBrokerError {
  return new PrivateRepositorySourceBrokerError(code, message);
}

function nowFrom(dependencies: PrivateRepositorySourceBrokerDependencies): Date {
  const now = (dependencies.now ?? (() => new Date()))();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw failure("PRIVATE_REPOSITORY_SOURCE_INVALID", "Private repository source clock is invalid.");
  }
  return now;
}

function positiveSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw failure("PRIVATE_REPOSITORY_SOURCE_INVALID", `Private repository ${label} is invalid.`);
  }
  return value;
}

function repositorySegment(value: string, label: string): string {
  if (
    typeof value !== "string"
    || value.length === 0
    || new TextEncoder().encode(value).byteLength > MAX_REPOSITORY_SEGMENT_BYTES
    || value.includes("/")
    || value.includes("\\")
    || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw failure("PRIVATE_REPOSITORY_SOURCE_INVALID", `Private repository ${label} is invalid.`);
  }
  return value;
}

function canonicalRepositoryUrl(value: string, owner: string, repository: string): string {
  if (
    typeof value !== "string"
    || value.length === 0
    || new TextEncoder().encode(value).byteLength > MAX_CANONICAL_URL_BYTES
  ) {
    throw failure("PRIVATE_REPOSITORY_SOURCE_INVALID", "Private repository canonical identity is invalid.");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw failure("PRIVATE_REPOSITORY_SOURCE_INVALID", "Private repository canonical identity is invalid.");
  }
  if (
    url.protocol !== "https:"
    || url.hostname.toLowerCase() !== "github.com"
    || (url.port && url.port !== "443")
    || url.username
    || url.password
    || url.search
    || url.hash
    || url.pathname !== `/${owner}/${repository}`
  ) {
    throw failure("PRIVATE_REPOSITORY_SOURCE_INVALID", "Private repository canonical identity is invalid.");
  }
  return `https://github.com/${owner}/${repository}`;
}

function timestamp(value: string, label: string): number {
  if (typeof value !== "string") {
    throw failure("PRIVATE_REPOSITORY_SOURCE_INVALID", `Private repository ${label} is invalid.`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw failure("PRIVATE_REPOSITORY_SOURCE_INVALID", `Private repository ${label} is invalid.`);
  }
  return parsed;
}

function assertRepositoryIdentity(
  repository: GitHubRepositorySummary,
  claim: Readonly<{
    repositoryId: number;
    owner: string;
    repository: string;
    canonicalRepositoryUrl: string;
  }>,
): void {
  if (
    repository.id !== claim.repositoryId
    || repository.ownerLogin !== claim.owner
    || repository.name !== claim.repository
    || repository.fullName !== `${claim.owner}/${claim.repository}`
    || repository.htmlUrl !== claim.canonicalRepositoryUrl
    || repository.isPrivate !== true
  ) {
    throw failure(
      "PRIVATE_REPOSITORY_SOURCE_IDENTITY_MISMATCH",
      "Private repository identity no longer matches the claimed project.",
    );
  }
}

function validateResolvedCommitSha(value: string): string {
  if (typeof value !== "string" || !COMMIT_SHA_PATTERN.test(value)) {
    throw failure("PRIVATE_REPOSITORY_SOURCE_UNAVAILABLE", "Private repository commit could not be resolved safely.");
  }
  return value;
}

function validateArchiveUrl(
  value: string,
  owner: string,
  repository: string,
  resolvedCommitSha: string,
): string {
  if (
    typeof value !== "string"
    || value.length === 0
    || new TextEncoder().encode(value).byteLength > MAX_ARCHIVE_URL_BYTES
  ) {
    throw failure("PRIVATE_REPOSITORY_SOURCE_UNAVAILABLE", "Private repository archive capability is invalid.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw failure("PRIVATE_REPOSITORY_SOURCE_UNAVAILABLE", "Private repository archive capability is invalid.");
  }
  const segments = url.pathname.split("/").filter(Boolean);
  if (
    url.protocol !== "https:"
    || url.hostname.toLowerCase() !== "codeload.github.com"
    || (url.port && url.port !== "443")
    || url.username
    || url.password
    || url.hash
    || segments.length < 4
    || segments[0] !== owner
    || segments[1] !== repository
    || segments[segments.length - 1] !== resolvedCommitSha
  ) {
    throw failure("PRIVATE_REPOSITORY_SOURCE_IDENTITY_MISMATCH", "Private repository archive capability does not match the claimed commit.");
  }
  return url.toString();
}

function boundedLeaseExpiry(
  now: Date,
  installationTokenExpiresAt: string,
  absoluteDeadlineAt: string,
  workerLeaseExpiresAt: string,
): string {
  const tokenExpiry = timestamp(installationTokenExpiresAt, "installation authority expiry");
  const deadline = timestamp(absoluteDeadlineAt, "task deadline");
  const workerLeaseExpiry = timestamp(workerLeaseExpiresAt, "worker lease expiry");
  const nowMs = now.getTime();
  if (
    tokenExpiry - nowMs < MIN_REMAINING_AUTHORITY_MS
    || deadline - nowMs < MIN_REMAINING_AUTHORITY_MS
    || workerLeaseExpiry - nowMs < MIN_REMAINING_AUTHORITY_MS
  ) {
    throw failure(
      "PRIVATE_REPOSITORY_SOURCE_AUTHORITY_EXPIRED",
      "Private repository source authority is expired.",
    );
  }
  return new Date(Math.min(
    nowMs + PRIVATE_ARCHIVE_LEASE_TTL_MS,
    tokenExpiry,
    deadline,
    workerLeaseExpiry,
  )).toISOString();
}

async function providerCall<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof PrivateRepositorySourceBrokerError) throw error;
    throw failure(
      "PRIVATE_REPOSITORY_SOURCE_UNAVAILABLE",
      "Private repository source could not be authorized safely.",
    );
  }
}

export async function createPrivateRepositorySourceLease(
  input: PrivateRepositorySourceClaim,
  dependencies: PrivateRepositorySourceBrokerDependencies,
): Promise<GitHubPrivateArchiveLease> {
  const now = nowFrom(dependencies);
  const installationId = positiveSafeInteger(input.installationId, "installation identifier");
  const repositoryId = positiveSafeInteger(input.repositoryId, "identifier");
  const owner = repositorySegment(input.owner, "owner");
  const repositoryName = repositorySegment(input.repository, "name");
  const canonicalUrl = canonicalRepositoryUrl(
    input.canonicalRepositoryUrl,
    owner,
    repositoryName,
  );
  const deadline = timestamp(input.absoluteDeadlineAt, "task deadline");
  const workerLeaseExpiry = timestamp(input.leaseExpiresAt, "worker lease expiry");
  if (
    deadline - now.getTime() < MIN_REMAINING_AUTHORITY_MS
    || workerLeaseExpiry - now.getTime() < MIN_REMAINING_AUTHORITY_MS
  ) {
    throw failure("PRIVATE_REPOSITORY_SOURCE_AUTHORITY_EXPIRED", "Private repository source authority is expired.");
  }

  const mintInstallationToken = dependencies.createInstallationToken ?? createInstallationToken;
  const readRepository = dependencies.getInstallationRepository ?? getInstallationRepository;
  const resolveCommit = dependencies.resolveInstallationRepositoryCommitSha ?? resolveInstallationRepositoryCommitSha;
  const readArchiveRedirect = dependencies.getInstallationRepositoryArchiveRedirect ?? getInstallationRepositoryArchiveRedirect;

  const installationToken = await providerCall(() => mintInstallationToken(
    installationId,
    dependencies.config,
    { repositoryId },
  ));
  const expiresAt = boundedLeaseExpiry(
    now,
    installationToken.expiresAt,
    input.absoluteDeadlineAt,
    input.leaseExpiresAt,
  );

  const repository = await providerCall(() => readRepository(
    installationToken.token,
    repositoryId,
  ));
  assertRepositoryIdentity(repository, {
    repositoryId,
    owner,
    repository: repositoryName,
    canonicalRepositoryUrl: canonicalUrl,
  });

  const resolvedCommitSha = validateResolvedCommitSha(await providerCall(() => resolveCommit(
    installationToken.token,
    owner,
    repositoryName,
    repository.defaultBranch,
  )));
  const archiveUrl = validateArchiveUrl(
    await providerCall(() => readArchiveRedirect(
      installationToken.token,
      owner,
      repositoryName,
      resolvedCommitSha,
    )),
    owner,
    repositoryName,
    resolvedCommitSha,
  );

  return Object.freeze({
    kind: "github_private_archive_lease_v1",
    canonicalRepositoryUrl: canonicalUrl,
    defaultBranch: repository.defaultBranch,
    resolvedCommitSha,
    archiveUrl,
    expiresAt,
  });
}
