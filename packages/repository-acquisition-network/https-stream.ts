import { lookup } from "node:dns/promises";
import { request as httpsRequest, type RequestOptions } from "node:https";
import { isIP } from "node:net";
import { selectPinnedPublicAddress } from "@/packages/network-safety";
import {
  assertGitHubNetworkUrl,
  GITHUB_ACQUISITION_USER_AGENT,
  GITHUB_API_HOST,
  GITHUB_API_VERSION,
  GITHUB_ARCHIVE_HOST,
  type GitHubNetworkTarget,
} from "./policy";
import type {
  GitHubPinnedResponse,
  GitHubPinnedTransport,
} from "./types";

const HEADER_TIMEOUT_MS = 30_000;

export interface GitHubResolver {
  resolve(hostname: string): Promise<readonly string[]>;
}

export const defaultGitHubResolver: GitHubResolver = Object.freeze({
  async resolve(hostname: string): Promise<readonly string[]> {
    const records = await lookup(hostname, { all: true, verbatim: true });
    return records.map((record) => record.address);
  },
});

function targetForHost(hostname: string): GitHubNetworkTarget {
  const normalized = hostname.toLowerCase();
  if (normalized === GITHUB_API_HOST) return "api";
  if (normalized === GITHUB_ARCHIVE_HOST) return "archive";
  throw new Error("GitHub acquisition rejected an unreviewed host.");
}

export function buildPinnedGitHubRequestOptions(input: {
  url: URL;
  address: string;
  family: 4 | 6;
  timeoutMs: number;
}): RequestOptions {
  const target = targetForHost(input.url.hostname);
  assertGitHubNetworkUrl(input.url, target);
  if (!Number.isInteger(input.timeoutMs) || input.timeoutMs < 1 || input.timeoutMs > HEADER_TIMEOUT_MS) {
    throw new Error("GitHub acquisition request timeout is invalid.");
  }
  const detectedFamily = isIP(input.address);
  if (detectedFamily !== input.family || (detectedFamily !== 4 && detectedFamily !== 6)) {
    throw new Error("GitHub acquisition requires a validated pinned IP address.");
  }

  const headers: Record<string, string> = {
    accept: target === "api" ? "application/vnd.github+json" : "application/octet-stream",
    "user-agent": GITHUB_ACQUISITION_USER_AGENT,
  };
  if (target === "api") headers["x-github-api-version"] = GITHUB_API_VERSION;

  return {
    method: "GET",
    agent: false,
    hostname: input.url.hostname.toLowerCase(),
    servername: input.url.hostname.toLowerCase(),
    port: 443,
    path: `${input.url.pathname}${input.url.search}`,
    timeout: input.timeoutMs,
    headers,
    lookup: ((_hostname: string, _options: unknown, callback: (
      error: NodeJS.ErrnoException | null,
      address: string,
      family: number,
    ) => void) => {
      callback(null, input.address, input.family);
    }) as RequestOptions["lookup"],
  };
}

function normalizeHeaders(
  headers: Readonly<Record<string, string | string[] | undefined>>,
): Readonly<Record<string, string | undefined>> {
  const result: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      result[name.toLowerCase()] = value.length === 1 ? value[0] : undefined;
    } else {
      result[name.toLowerCase()] = value;
    }
  }
  return Object.freeze(result);
}

export function createPinnedGitHubTransport(input: {
  resolver?: GitHubResolver;
  timeoutMs?: number;
} = {}): GitHubPinnedTransport {
  const resolver = input.resolver ?? defaultGitHubResolver;
  const timeoutMs = input.timeoutMs ?? HEADER_TIMEOUT_MS;

  return Object.freeze({
    async request(url: URL, signal: AbortSignal): Promise<GitHubPinnedResponse> {
      const target = targetForHost(url.hostname);
      assertGitHubNetworkUrl(url, target);
      if (signal.aborted) throw new DOMException("GitHub acquisition was aborted.", "AbortError");

      const addresses = await resolver.resolve(url.hostname);
      const pinned = selectPinnedPublicAddress(addresses);
      const options = buildPinnedGitHubRequestOptions({
        url,
        ...pinned,
        timeoutMs,
      });

      return new Promise<GitHubPinnedResponse>((resolve, reject) => {
        let settled = false;
        const request = httpsRequest({ ...options, signal }, (response) => {
          if (settled) {
            response.destroy();
            return;
          }
          settled = true;
          resolve(Object.freeze({
            status: response.statusCode ?? 0,
            headers: normalizeHeaders(response.headers),
            body: response,
          }));
        });
        request.on("timeout", () => {
          request.destroy(Object.assign(new Error("GitHub acquisition request timed out."), { name: "TimeoutError" }));
        });
        request.on("error", (error) => {
          if (!settled) {
            settled = true;
            reject(error);
          }
        });
        request.end();
      });
    },
  });
}
