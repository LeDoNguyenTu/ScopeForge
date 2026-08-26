import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { createGitHubRepositoryAcquirer } from "@/packages/repository-acquisition-network/github-client";
import type {
  GitHubPinnedResponse,
  GitHubPinnedTransport,
} from "@/packages/repository-acquisition-network/types";

function response(input: {
  status: number;
  body?: string | Buffer;
  headers?: Record<string, string>;
}): GitHubPinnedResponse {
  return {
    status: input.status,
    headers: Object.freeze(input.headers ?? {}),
    body: Readable.from(input.body === undefined ? [] : [input.body]),
  };
}

const sha = "a".repeat(40);

describe("Phase 6B GitHub repository acquirer", () => {
  it("resolves exact public identity, bounded default branch, and immutable commit", async () => {
    const request = vi.fn(async (url: URL) => {
      if (url.pathname === "/repos/octocat/Hello-World") {
        return response({
          status: 200,
          body: JSON.stringify({
            private: false,
            html_url: "https://github.com/octocat/Hello-World",
            default_branch: "feature/test",
          }),
        });
      }
      if (url.pathname === "/repos/octocat/Hello-World/commits/feature%2Ftest") {
        return response({ status: 200, body: JSON.stringify({ sha }) });
      }
      throw new Error(`Unexpected URL ${url.toString()}`);
    });
    const transport: GitHubPinnedTransport = { request };
    const acquirer = createGitHubRepositoryAcquirer({ transport });

    await expect(acquirer.resolveRepository("octocat", "Hello-World", new AbortController().signal)).resolves.toEqual({
      canonicalRepositoryUrl: "https://github.com/octocat/Hello-World",
      defaultBranch: "feature/test",
      commitSha: sha,
    });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("fails closed on moved/private repositories and malformed commit identity", async () => {
    for (const metadata of [
      { private: true, html_url: "https://github.com/octocat/Hello-World", default_branch: "main" },
      { private: false, html_url: "https://github.com/new-owner/Hello-World", default_branch: "main" },
    ]) {
      const transport: GitHubPinnedTransport = {
        request: vi.fn().mockResolvedValue(response({ status: 200, body: JSON.stringify(metadata) })),
      };
      const acquirer = createGitHubRepositoryAcquirer({ transport });
      await expect(acquirer.resolveRepository("octocat", "Hello-World", new AbortController().signal)).rejects.toThrow();
    }

    const transport: GitHubPinnedTransport = {
      request: vi.fn(async (url: URL) => url.pathname.endsWith("/Hello-World")
        ? response({
            status: 200,
            body: JSON.stringify({
              private: false,
              html_url: "https://github.com/octocat/Hello-World",
              default_branch: "main",
            }),
          })
        : response({ status: 200, body: JSON.stringify({ sha: "not-a-sha" }) })),
    };
    const acquirer = createGitHubRepositoryAcquirer({ transport });
    await expect(acquirer.resolveRepository("octocat", "Hello-World", new AbortController().signal)).rejects.toThrow();
  });

  it("opens an immutable tarball through exactly one codeload redirect", async () => {
    const request = vi.fn(async (url: URL) => {
      if (url.hostname === "api.github.com") {
        expect(url.pathname).toBe(`/repos/octocat/Hello-World/tarball/${sha}`);
        return response({
          status: 302,
          headers: { location: `https://codeload.github.com/octocat/Hello-World/legacy.tar.gz/${sha}` },
        });
      }
      if (url.hostname === "codeload.github.com") {
        return response({
          status: 200,
          headers: { "content-type": "application/x-gzip", "content-length": "3" },
          body: Buffer.from([0x1f, 0x8b, 0x08]),
        });
      }
      throw new Error("Unexpected host");
    });
    const acquirer = createGitHubRepositoryAcquirer({ transport: { request } });
    const archive = await acquirer.openArchive("octocat", "Hello-World", sha, new AbortController().signal);

    expect(archive.contentLength).toBe(3);
    expect(archive.contentType).toBe("application/x-gzip");
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("rejects redirects outside the reviewed codeload host", async () => {
    const acquirer = createGitHubRepositoryAcquirer({
      transport: {
        request: vi.fn().mockResolvedValue(response({
          status: 302,
          headers: { location: `https://example.com/archive/${sha}` },
        })),
      },
    });

    await expect(acquirer.openArchive("octocat", "Hello-World", sha, new AbortController().signal)).rejects.toThrow();
  });
});
