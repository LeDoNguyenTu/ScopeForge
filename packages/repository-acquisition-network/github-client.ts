import { Buffer } from "node:buffer";
import {
  assertGitHubCommitSha,
  assertGitHubDefaultBranch,
  assertGitHubNetworkUrl,
  assertGitHubOwnerName,
  assertGitHubRepositoryName,
  githubCommitApiUrl,
  githubRepositoryApiUrl,
  githubRepositoryUrl,
  githubTarballApiUrl,
} from "./policy";
import { createPinnedGitHubTransport } from "./https-stream";
import type {
  GitHubArchiveStream,
  GitHubPinnedResponse,
  GitHubPinnedTransport,
  GitHubRepositoryAcquirer,
  GitHubRepositoryResolution,
} from "./types";

const MAX_JSON_RESPONSE_BYTES = 262_144;
const MAX_COMPRESSED_ARCHIVE_BYTES = 134_217_728;
const MAX_REDIRECT_URL_BYTES = 4_096;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readBoundedJson(
  response: GitHubPinnedResponse,
  signal: AbortSignal,
): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for await (const chunk of response.body) {
      if (signal.aborted) throw new DOMException("GitHub acquisition was aborted.", "AbortError");
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      total += bytes.length;
      if (total > MAX_JSON_RESPONSE_BYTES) {
        throw new Error("GitHub API response exceeds the repository acquisition bound.");
      }
      chunks.push(bytes);
    }
  } finally {
    if (!response.body.destroyed) response.body.destroy();
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("GitHub API returned malformed JSON.");
  }
}

function parseContentLength(value: string | undefined): number | null {
  if (value === undefined) return null;
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error("GitHub archive content length is invalid.");
  }
  const size = Number(value);
  if (!Number.isSafeInteger(size) || size < 0 || size > MAX_COMPRESSED_ARCHIVE_BYTES) {
    throw new Error("GitHub archive exceeds the compressed-byte safety bound.");
  }
  return size;
}

export function createGitHubRepositoryAcquirer(input: {
  transport?: GitHubPinnedTransport;
} = {}): GitHubRepositoryAcquirer {
  const transport = input.transport ?? createPinnedGitHubTransport();

  return Object.freeze({
    async resolveRepository(
      owner: string,
      repository: string,
      signal: AbortSignal,
    ): Promise<GitHubRepositoryResolution> {
      const safeOwner = assertGitHubOwnerName(owner);
      const safeRepository = assertGitHubRepositoryName(repository);
      const expectedCanonicalUrl = githubRepositoryUrl(safeOwner, safeRepository);

      const metadataResponse = await transport.request(
        githubRepositoryApiUrl(safeOwner, safeRepository),
        signal,
      );
      if (metadataResponse.status !== 200) {
        metadataResponse.body.destroy();
        if (metadataResponse.status === 301) {
          throw new Error("GitHub repository identity changed.");
        }
        throw new Error(`GitHub repository metadata request failed with status ${metadataResponse.status}.`);
      }
      const metadata = await readBoundedJson(metadataResponse, signal);
      if (!isRecord(metadata)
          || metadata.private !== false
          || typeof metadata.html_url !== "string"
          || typeof metadata.default_branch !== "string") {
        throw new Error("GitHub repository metadata is not an allowed public repository response.");
      }
      if (metadata.html_url.toLowerCase() !== expectedCanonicalUrl.toLowerCase()) {
        throw new Error("GitHub repository identity changed.");
      }
      const defaultBranch = assertGitHubDefaultBranch(metadata.default_branch);

      const commitResponse = await transport.request(
        githubCommitApiUrl(safeOwner, safeRepository, defaultBranch),
        signal,
      );
      if (commitResponse.status !== 200) {
        commitResponse.body.destroy();
        throw new Error(`GitHub default-branch resolution failed with status ${commitResponse.status}.`);
      }
      const commit = await readBoundedJson(commitResponse, signal);
      if (!isRecord(commit) || typeof commit.sha !== "string") {
        throw new Error("GitHub commit response is malformed.");
      }
      const commitSha = assertGitHubCommitSha(commit.sha);

      return Object.freeze({
        canonicalRepositoryUrl: expectedCanonicalUrl,
        defaultBranch,
        commitSha,
      });
    },

    async openArchive(
      owner: string,
      repository: string,
      commitSha: string,
      signal: AbortSignal,
    ): Promise<GitHubArchiveStream> {
      const safeOwner = assertGitHubOwnerName(owner);
      const safeRepository = assertGitHubRepositoryName(repository);
      const safeCommitSha = assertGitHubCommitSha(commitSha);
      const initial = await transport.request(
        githubTarballApiUrl(safeOwner, safeRepository, safeCommitSha),
        signal,
      );
      if (initial.status !== 302) {
        initial.body.destroy();
        throw new Error(`GitHub archive endpoint returned unexpected status ${initial.status}.`);
      }
      const location = initial.headers.location;
      initial.body.destroy();
      if (location === undefined || Buffer.byteLength(location, "utf8") > MAX_REDIRECT_URL_BYTES) {
        throw new Error("GitHub archive redirect is missing or too large.");
      }

      let redirectUrl: URL;
      try {
        redirectUrl = new URL(location);
      } catch {
        throw new Error("GitHub archive redirect URL is invalid.");
      }
      assertGitHubNetworkUrl(redirectUrl, "archive");

      const archive = await transport.request(redirectUrl, signal);
      if (archive.status !== 200) {
        archive.body.destroy();
        throw new Error(`GitHub archive download returned unexpected status ${archive.status}.`);
      }

      return Object.freeze({
        response: archive.body,
        contentType: archive.headers["content-type"] ?? null,
        contentLength: parseContentLength(archive.headers["content-length"]),
      });
    },
  });
}
