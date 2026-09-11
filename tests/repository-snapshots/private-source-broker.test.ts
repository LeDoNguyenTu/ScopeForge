import { describe, expect, it, vi } from "vitest";
import { createPrivateRepositorySourceLease } from "@/lib/repository-snapshots/private-source-broker";
import type { GitHubAppConfig } from "@/lib/github-app/types";

const NOW = new Date("2026-09-11T00:00:00.000Z");
const COMMIT = "a".repeat(40);
const CANONICAL = "https://github.com/example-org/private-repo";
const ARCHIVE = `https://codeload.github.com/example-org/private-repo/legacy.tar.gz/${COMMIT}?token=temporary`;

function config(): GitHubAppConfig {
  return {
    appId: "123456",
    clientId: "Iv1.0123456789abcdef",
    clientSecret: "client-secret-value-that-must-never-leak",
    privateKey: "-----BEGIN PRIVATE KEY-----\nprivate-key-material\n-----END PRIVATE KEY-----",
    slug: "scopeforge-dev",
    stateSecret: "state-secret-that-must-never-leak",
    webhookSecret: "webhook-secret-that-must-never-leak-0123456789",
  };
}

function claim(overrides: Record<string, unknown> = {}) {
  return {
    installationId: 42,
    repositoryId: 99,
    owner: "example-org",
    repository: "private-repo",
    canonicalRepositoryUrl: CANONICAL,
    absoluteDeadlineAt: "2026-09-11T00:10:00.000Z",
    leaseExpiresAt: "2026-09-11T00:01:30.000Z",
    ...overrides,
  };
}

function dependencies(repositoryOverrides: Record<string, unknown> = {}) {
  return {
    config: config(),
    now: () => NOW,
    createInstallationToken: vi.fn(async () => ({
      token: "ghs_ephemeral_private_token",
      expiresAt: "2026-09-11T01:00:00.000Z",
    })),
    getInstallationRepository: vi.fn(async () => ({
      id: 99,
      ownerLogin: "example-org",
      name: "private-repo",
      fullName: "example-org/private-repo",
      defaultBranch: "main",
      isPrivate: true,
      htmlUrl: CANONICAL,
      ...repositoryOverrides,
    })),
    resolveInstallationRepositoryCommitSha: vi.fn(async () => COMMIT),
    getInstallationRepositoryArchiveRedirect: vi.fn(async () => ARCHIVE),
  };
}

describe("Phase 10A2 private repository source broker", () => {
  it("mints a repository-scoped token and returns only an attempt-bounded source lease", async () => {
    const deps = dependencies();
    const result = await createPrivateRepositorySourceLease(claim(), deps);

    expect(deps.createInstallationToken).toHaveBeenCalledWith(
      42,
      deps.config,
      { repositoryId: 99 },
    );
    expect(deps.getInstallationRepository).toHaveBeenCalledWith(
      "ghs_ephemeral_private_token",
      99,
    );
    expect(deps.resolveInstallationRepositoryCommitSha).toHaveBeenCalledWith(
      "ghs_ephemeral_private_token",
      "example-org",
      "private-repo",
      "main",
    );
    expect(deps.getInstallationRepositoryArchiveRedirect).toHaveBeenCalledWith(
      "ghs_ephemeral_private_token",
      "example-org",
      "private-repo",
      COMMIT,
    );

    expect(result).toEqual({
      kind: "github_private_archive_lease_v1",
      canonicalRepositoryUrl: CANONICAL,
      defaultBranch: "main",
      resolvedCommitSha: COMMIT,
      archiveUrl: ARCHIVE,
      expiresAt: "2026-09-11T00:01:30.000Z",
    });

    const serialized = JSON.stringify(result);
    for (const forbidden of [
      "ghs_ephemeral_private_token",
      "Authorization",
      "Bearer",
      "client-secret-value-that-must-never-leak",
      "private-key-material",
      "state-secret-that-must-never-leak",
      "webhook-secret-that-must-never-leak",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("fails closed if GitHub reports the claimed repository as public", async () => {
    const deps = dependencies({ isPrivate: false });
    await expect(createPrivateRepositorySourceLease(claim(), deps)).rejects.toThrow(/private|identity/i);
    expect(deps.resolveInstallationRepositoryCommitSha).not.toHaveBeenCalled();
    expect(deps.getInstallationRepositoryArchiveRedirect).not.toHaveBeenCalled();
  });

  it("fails closed if immutable repository identity no longer matches the claim", async () => {
    for (const mismatch of [
      { id: 100 },
      { ownerLogin: "other-org", fullName: "other-org/private-repo", htmlUrl: "https://github.com/other-org/private-repo" },
      { name: "renamed", fullName: "example-org/renamed", htmlUrl: "https://github.com/example-org/renamed" },
      { htmlUrl: "https://github.com/example-org/renamed" },
    ]) {
      const deps = dependencies(mismatch);
      await expect(createPrivateRepositorySourceLease(claim(), deps)).rejects.toThrow(/identity|repository/i);
      expect(deps.getInstallationRepositoryArchiveRedirect).not.toHaveBeenCalled();
    }
  });

  it("caps the worker lease before token expiry, task deadline, worker lease, and GitHub's archive window", async () => {
    const deps = dependencies();
    deps.createInstallationToken.mockResolvedValueOnce({
      token: "ghs_ephemeral_private_token",
      expiresAt: "2026-09-11T00:02:30.000Z",
    });

    const result = await createPrivateRepositorySourceLease(
      claim({
        absoluteDeadlineAt: "2026-09-11T00:03:00.000Z",
        leaseExpiresAt: "2026-09-11T00:05:00.000Z",
      }),
      deps,
    );
    expect(result.expiresAt).toBe("2026-09-11T00:02:30.000Z");
  });

  it("never lets the private archive capability outlive the current worker lease", async () => {
    const deps = dependencies();
    const result = await createPrivateRepositorySourceLease(
      claim({
        absoluteDeadlineAt: "2026-09-11T00:10:00.000Z",
        leaseExpiresAt: "2026-09-11T00:00:45.000Z",
      }),
      deps,
    );
    expect(result.expiresAt).toBe("2026-09-11T00:00:45.000Z");
  });

  it("rejects expired authority before returning any archive capability", async () => {
    const deps = dependencies();
    deps.createInstallationToken.mockResolvedValueOnce({
      token: "ghs_ephemeral_private_token",
      expiresAt: "2026-09-10T23:59:59.000Z",
    });

    await expect(createPrivateRepositorySourceLease(claim(), deps)).rejects.toThrow(/expired|authority|lease/i);
    expect(deps.getInstallationRepositoryArchiveRedirect).not.toHaveBeenCalled();
  });

  it("rejects an already-expired worker lease before minting provider authority", async () => {
    const deps = dependencies();
    await expect(createPrivateRepositorySourceLease(
      claim({ leaseExpiresAt: "2026-09-10T23:59:59.000Z" }),
      deps,
    )).rejects.toThrow(/expired|authority|lease/i);
    expect(deps.createInstallationToken).not.toHaveBeenCalled();
  });

  it("rejects a redirect that is not bound to the exact private repository commit", async () => {
    const deps = dependencies();
    deps.getInstallationRepositoryArchiveRedirect.mockResolvedValueOnce(
      `https://codeload.github.com/other-org/private-repo/legacy.tar.gz/${COMMIT}?token=temporary`,
    );
    await expect(createPrivateRepositorySourceLease(claim(), deps)).rejects.toThrow(/archive|identity|repository/i);
  });
});
