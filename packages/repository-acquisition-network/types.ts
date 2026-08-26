import type { Readable } from "node:stream";

export interface GitHubRepositoryResolution {
  canonicalRepositoryUrl: string;
  defaultBranch: string;
  commitSha: string;
}

export interface GitHubArchiveStream {
  response: Readable;
  contentType: string | null;
  contentLength: number | null;
}

export interface GitHubRepositoryAcquirer {
  resolveRepository(
    owner: string,
    repository: string,
    signal: AbortSignal,
  ): Promise<GitHubRepositoryResolution>;

  openArchive(
    owner: string,
    repository: string,
    commitSha: string,
    signal: AbortSignal,
  ): Promise<GitHubArchiveStream>;
}

export interface GitHubPinnedResponse {
  status: number;
  headers: Readonly<Record<string, string | undefined>>;
  body: Readable;
}

export interface GitHubPinnedTransport {
  request(url: URL, signal: AbortSignal): Promise<GitHubPinnedResponse>;
}
