import { Buffer } from "node:buffer";
import type { GitHubPrivateArchiveLease } from "@/packages/worker-contracts";
import { createPinnedGitHubTransport } from "./https-stream";
import {
  assertGitHubCommitSha,
  assertGitHubDefaultBranch,
  assertGitHubNetworkUrl,
  assertGitHubOwnerName,
  assertGitHubRepositoryName,
  githubRepositoryUrl,
} from "./policy";
import type {
  GitHubArchiveStream,
  GitHubPinnedTransport,
} from "./types";

const MAX_COMPRESSED_ARCHIVE_BYTES = 134_217_728;

export interface PrivateRepositoryArchiveReader {
  openArchive(
    lease: GitHubPrivateArchiveLease,
    signal: AbortSignal,
  ): Promise<GitHubArchiveStream>;
}

function parseContentLength(value: string | undefined): number | null {
  if (value === undefined) return null;
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error("Private GitHub archive content length is invalid.");
  }
  const size = Number(value);
  if (!Number.isSafeInteger(size) || size < 0 || size > MAX_COMPRESSED_ARCHIVE_BYTES) {
    throw new Error("Private GitHub archive exceeds the compressed-byte safety bound.");
  }
  return size;
}

function validatedLease(
  lease: GitHubPrivateArchiveLease,
  now: number,
): URL {
  if (lease.kind !== "github_private_archive_lease_v1") {
    throw new Error("Private GitHub archive lease kind is invalid.");
  }

  let repositoryUrl: URL;
  try {
    repositoryUrl = new URL(lease.canonicalRepositoryUrl);
  } catch {
    throw new Error("Private GitHub repository identity is invalid.");
  }
  if (
    repositoryUrl.protocol !== "https:"
    || repositoryUrl.hostname.toLowerCase() !== "github.com"
    || (repositoryUrl.port && repositoryUrl.port !== "443")
    || repositoryUrl.username
    || repositoryUrl.password
    || repositoryUrl.search
    || repositoryUrl.hash
  ) {
    throw new Error("Private GitHub repository identity is invalid.");
  }

  const repositorySegments = repositoryUrl.pathname.split("/").filter(Boolean);
  if (repositorySegments.length !== 2) {
    throw new Error("Private GitHub repository identity is invalid.");
  }
  const owner = assertGitHubOwnerName(repositorySegments[0]);
  const repository = assertGitHubRepositoryName(repositorySegments[1]);
  if (lease.canonicalRepositoryUrl !== githubRepositoryUrl(owner, repository)) {
    throw new Error("Private GitHub repository identity is invalid.");
  }

  assertGitHubDefaultBranch(lease.defaultBranch);
  const commitSha = assertGitHubCommitSha(lease.resolvedCommitSha);
  const expiresAt = Date.parse(lease.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    throw new Error("Private GitHub archive lease is expired or invalid.");
  }

  let archiveUrl: URL;
  try {
    archiveUrl = new URL(lease.archiveUrl);
  } catch {
    throw new Error("Private GitHub archive capability URL is invalid.");
  }
  assertGitHubNetworkUrl(archiveUrl, "archive");
  if (Buffer.byteLength(lease.archiveUrl, "utf8") > 4_096) {
    throw new Error("Private GitHub archive capability URL exceeds the safety bound.");
  }

  const archiveSegments = archiveUrl.pathname.split("/").filter(Boolean);
  if (
    archiveSegments.length !== 4
    || archiveSegments[0] !== owner
    || archiveSegments[1] !== repository
    || archiveSegments[2] !== "legacy.tar.gz"
    || archiveSegments[3] !== commitSha
  ) {
    throw new Error("Private GitHub archive capability does not match the repository identity.");
  }

  return archiveUrl;
}

export function createPrivateRepositoryArchiveReader(input: {
  transport?: GitHubPinnedTransport;
  now?: () => number;
} = {}): PrivateRepositoryArchiveReader {
  const transport = input.transport ?? createPinnedGitHubTransport();
  const now = input.now ?? Date.now;

  return Object.freeze({
    async openArchive(
      lease: GitHubPrivateArchiveLease,
      signal: AbortSignal,
    ): Promise<GitHubArchiveStream> {
      if (signal.aborted) {
        throw new DOMException("Private GitHub archive acquisition was aborted.", "AbortError");
      }
      const archiveUrl = validatedLease(lease, now());
      const response = await transport.request(archiveUrl, signal);
      if (response.status !== 200) {
        response.body.destroy();
        throw new Error(`Private GitHub archive returned unexpected status ${response.status}; redirects are not permitted.`);
      }

      let contentLength: number | null;
      try {
        contentLength = parseContentLength(response.headers["content-length"]);
      } catch (error) {
        response.body.destroy();
        throw error;
      }

      return Object.freeze({
        response: response.body,
        contentType: response.headers["content-type"] ?? null,
        contentLength,
      });
    },
  });
}
