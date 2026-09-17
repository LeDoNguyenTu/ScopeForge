import { describe, expect, it, vi } from "vitest";
import * as githubClient from "@/lib/github-app/client";

const client = githubClient as unknown as {
  resolveInstallationRepositoryCommitSha?: (
    token: string,
    owner: string,
    repository: string,
    ref: string,
    fetchImpl?: typeof fetch,
  ) => Promise<string>;
  getInstallationRepositoryArchiveRedirect?: (
    token: string,
    owner: string,
    repository: string,
    commitSha: string,
    fetchImpl?: typeof fetch,
  ) => Promise<string>;
};

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Phase 10A2 GitHub private archive client", () => {
  it("resolves one immutable commit through GitHub's fixed commits endpoint", async () => {
    expect(typeof client.resolveInstallationRepositoryCommitSha).toBe("function");
    const resolveCommit = client.resolveInstallationRepositoryCommitSha!;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://api.github.com/repos/example-org/private-repo/commits/feature%2Fprivate-scan");
      expect(init?.method).toBe("GET");
      expect(init?.headers).toMatchObject({ Authorization: "Bearer ghs_ephemeral" });
      return jsonResponse({ sha: "a".repeat(40) });
    });

    await expect(resolveCommit(
      "ghs_ephemeral",
      "example-org",
      "private-repo",
      "feature/private-scan",
      fetchImpl,
    )).resolves.toBe("a".repeat(40));
  });

  it("requests one authenticated tarball redirect without following it", async () => {
    expect(typeof client.getInstallationRepositoryArchiveRedirect).toBe("function");
    const archiveRedirect = client.getInstallationRepositoryArchiveRedirect!;
    const commitSha = "b".repeat(40);
    const location = `https://codeload.github.com/example-org/private-repo/legacy.tar.gz/${commitSha}?token=short-lived`;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(`https://api.github.com/repos/example-org/private-repo/tarball/${commitSha}`);
      expect(init?.method).toBe("GET");
      expect(init?.redirect).toBe("manual");
      expect(init?.headers).toMatchObject({ Authorization: "Bearer ghs_ephemeral" });
      return new Response(null, { status: 302, headers: { location } });
    });

    await expect(archiveRedirect(
      "ghs_ephemeral",
      "example-org",
      "private-repo",
      commitSha,
      fetchImpl,
    )).resolves.toBe(location);
  });

  it("fails closed on non-302 archive responses without exposing provider bodies", async () => {
    expect(typeof client.getInstallationRepositoryArchiveRedirect).toBe("function");
    const archiveRedirect = client.getInstallationRepositoryArchiveRedirect!;
    const fetchImpl = vi.fn(async () => new Response("provider-secret-body", { status: 401 }));

    await expect(archiveRedirect(
      "ghs_ephemeral",
      "example-org",
      "private-repo",
      "c".repeat(40),
      fetchImpl,
    )).rejects.toThrow("GitHub provider request failed.");
    await expect(archiveRedirect(
      "ghs_ephemeral",
      "example-org",
      "private-repo",
      "c".repeat(40),
      fetchImpl,
    )).rejects.not.toThrow("provider-secret-body");
  });
});
