import { describe, expect, it } from "vitest";
import {
  validateWorkerTaskInput,
  workerExecutionProfile,
} from "@/packages/worker-contracts";

const validateTask = validateWorkerTaskInput as unknown as (
  value: unknown,
  executionClass: string,
) => unknown;
const profileFor = workerExecutionProfile as unknown as (executionClass: string) => unknown;

function validPrivateInput() {
  return {
    kind: "repository_snapshot_github_private",
    owner: "octocat",
    repository: "private-repo",
    canonicalRepositoryUrl: "https://github.com/octocat/private-repo",
    privateArchiveLease: {
      kind: "github_private_archive_lease_v1",
      canonicalRepositoryUrl: "https://github.com/octocat/private-repo",
      defaultBranch: "main",
      resolvedCommitSha: "a".repeat(40),
      archiveUrl: `https://codeload.github.com/octocat/private-repo/legacy.tar.gz/${"a".repeat(40)}?token=temporary-capability`,
      expiresAt: "2099-01-01T00:00:00.000Z",
    },
    artifactUpload: {
      method: "PUT",
      url: "https://scopeforge-artifacts.example.invalid/upload?signature=attempt-only",
      expiresAt: "2099-01-01T00:00:00.000Z",
    },
  };
}

describe("Phase 10A2 private repository worker contract", () => {
  it("defines a private execution class with a distinct closed network policy", () => {
    expect(profileFor("repository_snapshot_github_private_v1")).toEqual({
      executionClass: "repository_snapshot_github_private_v1",
      networkPolicy: "github_private_archive_lease_and_attempt_artifact_put_v1",
      budget: {
        maxWallTimeMs: 300_000,
        maxCpuTimeMs: 120_000,
        maxMemoryBytes: 536_870_912,
        maxProcesses: 1,
        maxInputFiles: 20_000,
        maxInputBytes: 268_435_456,
        maxScratchBytes: 536_870_912,
        maxOutputBytes: 65_536,
      },
    });
  });

  it("accepts only the exact private source-lease shape for the private class", () => {
    expect(validateTask(validPrivateInput(), "repository_snapshot_github_private_v1")).toEqual(
      validPrivateInput(),
    );
  });

  it("keeps the public snapshot execution class public-only", () => {
    expect(() => validateTask(
      validPrivateInput(),
      "repository_snapshot_github_public_v1",
    )).toThrow();
  });

  it("rejects credential and generic request authority in the private input", () => {
    for (const extra of [
      { installationToken: "ghs_secret" },
      { authorization: "Bearer ghs_secret" },
      { headers: { Authorization: "Bearer ghs_secret" } },
      { clientSecret: "secret" },
      { method: "POST" },
    ]) {
      expect(() => validateTask(
        { ...validPrivateInput(), ...extra },
        "repository_snapshot_github_private_v1",
      )).toThrow(/unexpected|invalid|unsupported/i);
    }
  });

  it("rejects arbitrary archive hosts and non-HTTPS archive capabilities", () => {
    for (const archiveUrl of [
      `https://example.com/octocat/private-repo/${"a".repeat(40)}`,
      `http://codeload.github.com/octocat/private-repo/${"a".repeat(40)}`,
      `https://api.github.com/repos/octocat/private-repo/tarball/${"a".repeat(40)}`,
      `https://codeload.github.com.evil.example/octocat/private-repo/${"a".repeat(40)}`,
    ]) {
      const input = validPrivateInput();
      input.privateArchiveLease.archiveUrl = archiveUrl;
      expect(() => validateTask(input, "repository_snapshot_github_private_v1")).toThrow();
    }
  });

  it("binds the lease to the same canonical repository and immutable commit", () => {
    const wrongRepository = validPrivateInput();
    wrongRepository.privateArchiveLease.canonicalRepositoryUrl = "https://github.com/octocat/other";
    expect(() => validateTask(wrongRepository, "repository_snapshot_github_private_v1")).toThrow();

    const badCommit = validPrivateInput();
    badCommit.privateArchiveLease.resolvedCommitSha = "g".repeat(40);
    expect(() => validateTask(badCommit, "repository_snapshot_github_private_v1")).toThrow();
  });

  it("rejects malformed or already-expired lease timestamps", () => {
    for (const expiresAt of ["not-a-date", "2000-01-01T00:00:00.000Z"]) {
      const input = validPrivateInput();
      input.privateArchiveLease.expiresAt = expiresAt;
      expect(() => validateTask(input, "repository_snapshot_github_private_v1")).toThrow();
    }
  });
});
