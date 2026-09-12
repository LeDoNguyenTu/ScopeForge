import { describe, expect, it, vi } from "vitest";
import { createWorkerControlRepository } from "@/lib/worker-control/repository";
import { workerExecutionProfile } from "@/packages/worker-contracts";

const workerId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const attemptId = "33333333-3333-4333-8333-333333333333";
const linkId = "44444444-4444-4444-8444-444444444444";

interface PrivateWorkerRepositorySurface {
  registerPrivateRepositorySnapshot(input: { credentialHash: string; softwareVersion: string }): Promise<unknown>;
}

describe("Phase 10A2 private worker persistence repository", () => {
  it("uses the dedicated private registration RPC", async () => {
    const rpc = vi.fn(async (name: string) => ({
      data: name === "register_private_repository_snapshot_worker_node" ? {
        workerId,
        executionClass: "repository_snapshot_github_private_v1",
        softwareVersion: "0.1.0",
      } : null,
      error: null,
    }));
    const repository = createWorkerControlRepository({ rpc } as never) as unknown as PrivateWorkerRepositorySurface;

    expect(typeof repository.registerPrivateRepositorySnapshot).toBe("function");
    await expect(repository.registerPrivateRepositorySnapshot({
      credentialHash: "a".repeat(64),
      softwareVersion: "0.1.0",
    })).resolves.toMatchObject({ executionClass: "repository_snapshot_github_private_v1" });
    expect(rpc).toHaveBeenCalledWith("register_private_repository_snapshot_worker_node", {
      target_credential_hash: "a".repeat(64),
      target_software_version: "0.1.0",
    });
  });

  it("parses a private claim as stable metadata only", async () => {
    const objectKey = `repository-source/${"b".repeat(64)}.tar.gz`;
    const rpc = vi.fn(async (name: string) => ({
      data: name === "claim_worker_task" ? {
        taskId,
        attemptId,
        executionClass: "repository_snapshot_github_private_v1",
        leaseToken: "c".repeat(64),
        leaseExpiresAt: "2026-09-11T00:01:30.000Z",
        absoluteDeadlineAt: "2026-09-11T00:20:00.000Z",
        budget: workerExecutionProfile("repository_snapshot_github_private_v1").budget,
        artifactObjectKey: objectKey,
        input: {
          kind: "repository_snapshot_github_private",
          owner: "octocat",
          repository: "private-repo",
          canonicalRepositoryUrl: "https://github.com/octocat/private-repo",
          githubRepositoryLinkId: linkId,
        },
      } : null,
      error: null,
    }));
    const repository = createWorkerControlRepository({ rpc } as never);
    const result = await repository.claim({ workerId });

    expect(result).toMatchObject({
      executionClass: "repository_snapshot_github_private_v1",
      artifactObjectKey: objectKey,
      input: {
        kind: "repository_snapshot_github_private",
        githubRepositoryLinkId: linkId,
      },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/installationToken|accessToken|archiveUrl|authorization|clientSecret|privateKey/i);
  });
});
