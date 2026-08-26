import { describe, expect, it } from "vitest";
import {
  assertGitHubNetworkUrl,
  assertGitHubRepositoryName,
  assertGitHubOwnerName,
  assertGitHubDefaultBranch,
} from "@/packages/repository-acquisition-network/policy";
import { buildPinnedGitHubRequestOptions } from "@/packages/repository-acquisition-network/https-stream";

describe("Phase 6B GitHub network policy", () => {
  it("allows only HTTPS 443 on reviewed GitHub hosts", () => {
    expect(() => assertGitHubNetworkUrl(new URL("https://api.github.com/repos/o/r"), "api")).not.toThrow();
    expect(() => assertGitHubNetworkUrl(new URL("https://codeload.github.com/o/r/tar.gz/x"), "archive")).not.toThrow();

    for (const input of [
      ["http://api.github.com/repos/o/r", "api"],
      ["https://api.github.com:444/repos/o/r", "api"],
      ["https://127.0.0.1/repos/o/r", "api"],
      ["https://example.com/repos/o/r", "api"],
      ["https://api.github.com/repos/o/r", "archive"],
      ["https://codeload.github.com/o/r", "api"],
    ] as const) {
      expect(() => assertGitHubNetworkUrl(new URL(input[0]), input[1])).toThrow();
    }
  });

  it("bounds repository identity and mutable branch text before URL building", () => {
    expect(assertGitHubOwnerName("octocat")).toBe("octocat");
    expect(assertGitHubRepositoryName("Hello-World.git")).toBe("Hello-World.git");
    expect(assertGitHubDefaultBranch("feature/日本語")).toBe("feature/日本語");

    expect(() => assertGitHubOwnerName("../owner")).toThrow();
    expect(() => assertGitHubRepositoryName("repo/name")).toThrow();
    expect(() => assertGitHubDefaultBranch("a".repeat(256))).toThrow();
    expect(() => assertGitHubDefaultBranch("bad\u0000branch")).toThrow();
  });

  it("pins the socket IP while preserving Host and TLS SNI", () => {
    const url = new URL("https://api.github.com/repos/octocat/Hello-World");
    const options = buildPinnedGitHubRequestOptions({
      url,
      address: "140.82.112.6",
      family: 4,
      timeoutMs: 5_000,
    });

    expect(options.hostname).toBe("api.github.com");
    expect(options.servername).toBe("api.github.com");
    expect(options.port).toBe(443);
    expect(options.path).toBe("/repos/octocat/Hello-World");
    expect(options.headers).toMatchObject({
      accept: "application/vnd.github+json",
      "user-agent": "ScopeForge-RepositoryAcquirer/0.1",
    });
    expect(options.lookup).toBeTypeOf("function");
  });
});
