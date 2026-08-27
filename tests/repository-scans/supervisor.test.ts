import { describe, expect, it, vi } from "vitest";
import { runWorkerOnce } from "@/packages/worker-supervisor";
import type { WorkerTaskContract, WorkerTerminalEnvelope } from "@/packages/worker-contracts";
import type { WorkerExecutor } from "@/packages/worker-supervisor/executor";
import type { RepositoryScanPreparer } from "@/packages/worker-supervisor/repository-scan";
import type { WorkerSupervisorControlClient } from "@/packages/worker-supervisor/control-client";

const task: WorkerTaskContract = {
  taskId: "11111111-1111-4111-8111-111111111111",
  attemptId: "22222222-2222-4222-8222-222222222222",
  executionClass: "phase3_repository_scan_no_egress_v1",
  leaseToken: "a".repeat(64),
  absoluteDeadlineAt: "2026-08-27T02:20:00.000Z",
  budget: {
    maxWallTimeMs: 300000,
    maxCpuTimeMs: 300000,
    maxMemoryBytes: 1073741824,
    maxProcesses: 64,
    maxInputFiles: 20000,
    maxInputBytes: 268435456,
    maxScratchBytes: 268435456,
    maxOutputBytes: 3670016,
  },
  input: {
    kind: "phase3_repository_scan",
    snapshotId: "33333333-3333-4333-8333-333333333333",
    canonicalRepositoryUrl: "https://github.com/openai/openai-node",
    resolvedCommitSha: "b".repeat(40),
    contentDigest: "c".repeat(64),
    artifactDigest: "d".repeat(64),
    storedArtifactBytes: 4096,
    retainedFileCount: 2,
    retainedBytes: 1024,
    scannerProfileId: "phase3-hosted-static-v1",
    scannerProfileVersion: 1,
  },
};

const success: WorkerTerminalEnvelope = {
  schemaVersion: 1,
  taskId: task.taskId,
  attemptId: task.attemptId,
  executionClass: "phase3_repository_scan_no_egress_v1",
  outcome: "succeeded",
  failureCode: null,
  metrics: { wallTimeMs: 10, cpuTimeMs: 0, peakMemoryBytes: 0, inputBytes: 1024, outputBytes: 100 },
  result: {
    kind: "phase3_repository_scan",
    snapshotId: "33333333-3333-4333-8333-333333333333",
    canonicalRepositoryUrl: "https://github.com/openai/openai-node",
    resolvedCommitSha: "b".repeat(40),
    contentDigest: "c".repeat(64),
    scannerProfileId: "phase3-hosted-static-v1",
    scannerProfileVersion: 1,
    resultDigest: "e".repeat(64),
    hostedResult: { schemaVersion: 1 },
  },
};

function control(overrides: Partial<WorkerSupervisorControlClient> = {}): WorkerSupervisorControlClient {
  return {
    claim: vi.fn(async () => task),
    repositoryScanArtifact: vi.fn(async () => ({
      snapshotId: task.input.kind === "phase3_repository_scan" ? task.input.snapshotId : "",
      storedArtifactBytes: 4096,
      artifactDigest: "d".repeat(64),
      download: {
        method: "GET",
        url: "https://scopeforge-source.example.invalid/repository-source/signed.tar.gz?signature=redacted",
        expiresAt: "2026-08-27T02:01:00.000Z",
      },
    })),
    repositoryScanFinalizeSuccess: vi.fn(async () => ({ outcome: "succeeded" as const, replayed: false })),
    heartbeat: vi.fn(async () => ({ cancelRequested: false, leaseExpiresAt: "2026-08-27T02:01:00.000Z" })),
    finalize: vi.fn(async ({ terminal }) => ({ outcome: terminal.outcome, replayed: false })),
    ...overrides,
  };
}

function preparer(cleanup = vi.fn(async () => undefined)): RepositoryScanPreparer {
  return {
    prepare: vi.fn(async ({ task: claimedTask, artifact }) => ({
      contract: {
        taskId: claimedTask.taskId,
        attemptId: claimedTask.attemptId,
        executionClass: "phase3_repository_scan_no_egress_v1" as const,
        absoluteDeadlineAt: claimedTask.absoluteDeadlineAt,
        budget: claimedTask.budget,
        input: {
          kind: "phase3_repository_scan_prepared" as const,
          sourceDirectory: "/var/lib/scopeforge/work/scan/materialized-source",
          snapshotId: artifact.snapshotId,
          canonicalRepositoryUrl: "https://github.com/openai/openai-node",
          resolvedCommitSha: "b".repeat(40),
          contentDigest: "c".repeat(64),
          scannerProfileId: "phase3-hosted-static-v1" as const,
          scannerProfileVersion: 1 as const,
          retainedBytes: 1024,
        },
      },
      cleanup,
    })),
  };
}

describe("Phase 6C supervisor preparation", () => {
  it("keeps lease and signed artifact authority outside the prepared executor contract and uses dedicated success publication", async () => {
    const repoControl = control();
    const prep = preparer();
    const executor: WorkerExecutor = {
      execute: vi.fn(async (contract) => {
        expect(contract.executionClass).toBe("phase3_repository_scan_no_egress_v1");
        expect(contract.input.kind).toBe("phase3_repository_scan_prepared");
        expect(contract).not.toHaveProperty("leaseToken");
        expect(JSON.stringify(contract)).not.toContain("X-Amz-");
        expect(JSON.stringify(contract)).not.toContain("signature=redacted");
        return success;
      }),
    };

    const result = await runWorkerOnce({
      control: repoControl,
      executor,
      repositoryScanPreparer: prep,
      heartbeatMs: 60_000,
      now: () => Date.parse("2026-08-27T02:00:00.000Z"),
    });

    expect(repoControl.repositoryScanArtifact).toHaveBeenCalledWith({
      taskId: task.taskId,
      attemptId: task.attemptId,
      leaseToken: task.leaseToken,
    });
    expect(prep.prepare).toHaveBeenCalled();
    expect(executor.execute).toHaveBeenCalled();
    expect(repoControl.repositoryScanFinalizeSuccess).toHaveBeenCalledWith({
      taskId: task.taskId,
      attemptId: task.attemptId,
      leaseToken: task.leaseToken,
      terminal: success,
    });
    expect(repoControl.finalize).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "completed", outcome: "succeeded", replayed: false });
  });

  it("aborts staging on cancellation and uses only generic cancellation finalization", async () => {
    const executor: WorkerExecutor = { execute: vi.fn(async () => success) };
    const prepare = vi.fn(async ({ signal }: Parameters<RepositoryScanPreparer["prepare"]>[0]) => {
      await new Promise<void>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")), { once: true });
      });
      throw new Error("unreachable");
    });
    const prep: RepositoryScanPreparer = { prepare };
    const repoControl = control({
      heartbeat: vi.fn(async () => ({ cancelRequested: true, leaseExpiresAt: "2026-08-27T02:01:00.000Z" })),
    });

    const result = await runWorkerOnce({
      control: repoControl,
      executor,
      repositoryScanPreparer: prep,
      heartbeatMs: 1,
      now: () => Date.parse("2026-08-27T02:00:00.000Z"),
    });

    expect(executor.execute).not.toHaveBeenCalled();
    expect(repoControl.repositoryScanFinalizeSuccess).not.toHaveBeenCalled();
    expect(repoControl.finalize).toHaveBeenCalledWith(expect.objectContaining({
      leaseToken: task.leaseToken,
      terminal: expect.objectContaining({ outcome: "cancelled" }),
    }));
    expect(result).toEqual({ status: "completed", outcome: "cancelled", replayed: false });
  });
});
