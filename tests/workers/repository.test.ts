import { describe, expect, it, vi } from "vitest";
import { createWorkerControlRepository } from "@/lib/worker-control/repository";
import { workerExecutionProfile } from "@/packages/worker-contracts";

describe("worker control repository", () => {
  it("uses only the closed worker RPC surface", async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === "authenticate_worker_node") {
        return {
          data: {
            workerId: "11111111-1111-4111-8111-111111111111",
            executionClass: "foundation_no_egress_v1",
            softwareVersion: "0.1.0",
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    const repository = createWorkerControlRepository({ rpc } as never);

    await expect(repository.authenticate({
      workerId: "11111111-1111-4111-8111-111111111111",
      credentialHash: "a".repeat(64),
    })).resolves.toMatchObject({ executionClass: "foundation_no_egress_v1" });

    expect(rpc).toHaveBeenCalledWith("authenticate_worker_node", {
      target_worker_id: "11111111-1111-4111-8111-111111111111",
      target_credential_hash: "a".repeat(64),
    });
  });

  it("parses repository claims into a private server-only intermediate", async () => {
    const objectKey = `repository-source/${"a".repeat(64)}.tar.gz`;
    const rpc = vi.fn(async (name: string) => {
      if (name === "claim_worker_task") {
        return {
          data: {
            taskId: "33333333-3333-4333-8333-333333333333",
            attemptId: "44444444-4444-4444-8444-444444444444",
            executionClass: "repository_snapshot_github_public_v1",
            leaseToken: "b".repeat(64),
            leaseExpiresAt: "2026-08-27T03:21:30.000Z",
            absoluteDeadlineAt: "2026-08-27T03:40:00.000Z",
            budget: workerExecutionProfile("repository_snapshot_github_public_v1").budget,
            artifactObjectKey: objectKey,
            input: {
              kind: "repository_snapshot_github_public",
              owner: "openai",
              repository: "openai-node",
              canonicalRepositoryUrl: "https://github.com/openai/openai-node",
            },
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    const repository = createWorkerControlRepository({ rpc } as never);
    const result = await repository.claim({ workerId: "11111111-1111-4111-8111-111111111111" });

    expect(result).toMatchObject({
      executionClass: "repository_snapshot_github_public_v1",
      artifactObjectKey: objectKey,
    });
    expect(result).not.toHaveProperty("leaseExpiresAt");
    expect(result && "input" in result ? result.input : null).not.toHaveProperty("artifactUpload");
  });

  it("maps database lease conflicts to a closed workflow error", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: "WORKER_LEASE_INVALID" },
    }));
    const repository = createWorkerControlRepository({ rpc } as never);

    await expect(repository.heartbeat({
      workerId: "11111111-1111-4111-8111-111111111111",
      taskId: "33333333-3333-4333-8333-333333333333",
      attemptId: "44444444-4444-4444-8444-444444444444",
      leaseToken: "b".repeat(64),
    })).rejects.toMatchObject({ code: "WORKER_LEASE_INVALID" });
  });

  it("never falls back to direct table mutation", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const from = vi.fn(() => { throw new Error("direct table access is forbidden"); });
    const repository = createWorkerControlRepository({ rpc, from } as never);

    await repository.claim({ workerId: "11111111-1111-4111-8111-111111111111" });
    expect(from).not.toHaveBeenCalled();
  });
});
