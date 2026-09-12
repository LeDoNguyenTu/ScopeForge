import type {
  GitHubPrivateArchiveLease,
  PrivateRepositorySnapshotInput,
  RepositorySnapshotUploadDescriptor,
} from "./types";

const PRIVATE_INPUT_KEYS = [
  "kind",
  "owner",
  "repository",
  "canonicalRepositoryUrl",
  "privateArchiveLease",
  "artifactUpload",
] as const;
const PRIVATE_LEASE_KEYS = [
  "kind",
  "canonicalRepositoryUrl",
  "defaultBranch",
  "resolvedCommitSha",
  "archiveUrl",
  "expiresAt",
] as const;
const UPLOAD_KEYS = ["method", "url", "expiresAt"] as const;
const COMMIT_SHA_PATTERN = /^[a-f0-9]{40}$/;
const MAX_DEFAULT_BRANCH_BYTES = 255;
const MAX_ARCHIVE_URL_BYTES = 4_096;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  context: string,
): void {
  const allowedSet = new Set(allowed);
  const unexpected = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unexpected.length > 0) {
    throw new Error(`${context} contains unexpected fields: ${unexpected.join(", ")}.`);
  }
  for (const key of allowed) {
    if (!(key in value)) throw new Error(`${context} is missing ${key}.`);
  }
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function boundedRepositorySegment(value: unknown, label: string): string {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > 100
    || value.includes("/")
    || value.includes("\\")
  ) {
    throw new Error(`Private repository ${label} is invalid.`);
  }
  return value;
}

function canonicalRepositoryUrl(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) {
    throw new Error("Private repository canonical URL is invalid.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Private repository canonical URL is invalid.");
  }

  if (
    url.protocol !== "https:"
    || url.hostname.toLowerCase() !== "github.com"
    || (url.port && url.port !== "443")
    || url.username
    || url.password
    || url.search
    || url.hash
  ) {
    throw new Error("Private repository canonical URL is invalid.");
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 2 || segments.some((segment) => segment.length === 0)) {
    throw new Error("Private repository canonical URL is invalid.");
  }
  return `https://github.com/${segments[0]}/${segments[1]}`;
}

function futureTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} is invalid.`);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
    throw new Error(`${label} is invalid or expired.`);
  }
  return value;
}

function uploadDescriptor(value: unknown): RepositorySnapshotUploadDescriptor {
  if (!isRecord(value)) throw new Error("Private repository upload descriptor is invalid.");
  exactKeys(value, UPLOAD_KEYS, "Private repository upload descriptor");
  if (value.method !== "PUT" || typeof value.url !== "string" || value.url.length === 0) {
    throw new Error("Private repository upload descriptor is invalid.");
  }
  return Object.freeze({
    method: "PUT",
    url: value.url,
    expiresAt: futureTimestamp(value.expiresAt, "Private repository upload expiry"),
  });
}

function archiveLease(
  value: unknown,
  owner: string,
  repository: string,
  expectedCanonicalUrl: string,
): GitHubPrivateArchiveLease {
  if (!isRecord(value)) throw new Error("Private repository archive lease is invalid.");
  exactKeys(value, PRIVATE_LEASE_KEYS, "Private repository archive lease");
  if (value.kind !== "github_private_archive_lease_v1") {
    throw new Error("Private repository archive lease kind is unsupported.");
  }

  const leaseCanonicalUrl = canonicalRepositoryUrl(value.canonicalRepositoryUrl);
  if (leaseCanonicalUrl !== expectedCanonicalUrl) {
    throw new Error("Private repository archive lease identity does not match the project.");
  }
  if (
    typeof value.defaultBranch !== "string"
    || value.defaultBranch.length === 0
    || utf8Bytes(value.defaultBranch) > MAX_DEFAULT_BRANCH_BYTES
  ) {
    throw new Error("Private repository archive lease default branch is invalid.");
  }
  if (typeof value.resolvedCommitSha !== "string" || !COMMIT_SHA_PATTERN.test(value.resolvedCommitSha)) {
    throw new Error("Private repository archive lease commit is invalid.");
  }
  if (
    typeof value.archiveUrl !== "string"
    || value.archiveUrl.length === 0
    || utf8Bytes(value.archiveUrl) > MAX_ARCHIVE_URL_BYTES
  ) {
    throw new Error("Private repository archive URL is invalid.");
  }

  let archiveUrl: URL;
  try {
    archiveUrl = new URL(value.archiveUrl);
  } catch {
    throw new Error("Private repository archive URL is invalid.");
  }
  if (
    archiveUrl.protocol !== "https:"
    || archiveUrl.hostname.toLowerCase() !== "codeload.github.com"
    || (archiveUrl.port && archiveUrl.port !== "443")
    || archiveUrl.username
    || archiveUrl.password
    || archiveUrl.hash
  ) {
    throw new Error("Private repository archive URL is invalid.");
  }

  const pathSegments = archiveUrl.pathname.split("/").filter(Boolean);
  if (
    pathSegments.length < 4
    || pathSegments[0] !== owner
    || pathSegments[1] !== repository
    || pathSegments[pathSegments.length - 1] !== value.resolvedCommitSha
  ) {
    throw new Error("Private repository archive URL is not bound to the expected repository commit.");
  }

  return Object.freeze({
    kind: "github_private_archive_lease_v1",
    canonicalRepositoryUrl: leaseCanonicalUrl,
    defaultBranch: value.defaultBranch,
    resolvedCommitSha: value.resolvedCommitSha,
    archiveUrl: archiveUrl.toString(),
    expiresAt: futureTimestamp(value.expiresAt, "Private repository archive lease expiry"),
  });
}

export function validatePrivateRepositorySnapshotInput(value: unknown): PrivateRepositorySnapshotInput {
  if (!isRecord(value)) throw new Error("Private repository task input must be an object.");
  exactKeys(value, PRIVATE_INPUT_KEYS, "Private repository task input");
  if (value.kind !== "repository_snapshot_github_private") {
    throw new Error("Private repository task input kind is unsupported.");
  }

  const owner = boundedRepositorySegment(value.owner, "owner");
  const repository = boundedRepositorySegment(value.repository, "name");
  const canonicalUrl = canonicalRepositoryUrl(value.canonicalRepositoryUrl);
  if (canonicalUrl !== `https://github.com/${owner}/${repository}`) {
    throw new Error("Private repository task identity does not match the canonical repository URL.");
  }

  return Object.freeze({
    kind: "repository_snapshot_github_private",
    owner,
    repository,
    canonicalRepositoryUrl: canonicalUrl,
    privateArchiveLease: archiveLease(
      value.privateArchiveLease,
      owner,
      repository,
      canonicalUrl,
    ),
    artifactUpload: uploadDescriptor(value.artifactUpload),
  });
}
