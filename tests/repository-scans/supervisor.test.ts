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
    artifactDigest: "d".repeat(64),
    scannerProfileId: "phase3-hosted-static-v1",
    scannerProfileVersion: 1,
    resultDigest: "e".repeat(64),
    hostedResult: { schemaVersion: 1 },
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function control(overrides: Partial<WorkerSupervisorControlClient> = {}): WorkerSupervisorControlClient {
  return {
    claim: vi.fn(async () => task),
    repositoryScanArtifact: vi.fn(async () => ({
      snapshotId: task.input.kind === "phase3_repository_scan" ? task.input.snapshotId : "",
      storedArtifactBytes: 4096,
      artifactDigest: "d".repeat(64),
      download: {
        method: "GET" as const,
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
          artifactDigest: artifact.artifactDigest,
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

  it("rejects a successful Phase 6C terminal when the artifact digest does not match the claimed snapshot", async () => {
    const repoControl = control();
    const mismatched = {
      ...success,
      result: success.result?.kind === "phase3_repository_scan"
        ? { ...success.result, artifactDigest: "f".repeat(64) }
        : success.result,
    } satisfies WorkerTerminalEnvelope;
    const executor: WorkerExecutor = { execute: vi.fn(async () => mismatched) };

    const result = await runWorkerOnce({
      control: repoControl,
      executor,
      repositoryScanPreparer: preparer(),
      heartbeatMs: 60_000,
      now: () => Date.parse("2026-08-27T02:00:00.000Z"),
    });

    expect(repoControl.repositoryScanFinalizeSuccess).not.toHaveBeenCalled();
    expect(repoControl.finalize).toHaveBeenCalledWith({
      leaseToken: task.leaseToken,
      terminal: expect.objectContaining({
        outcome: "failed",
        failureCode: "WORKER_OUTPUT_INVALID",
      }),
    });
    expect(result).toEqual({ status: "completed", outcome: "failed", replayed: false });
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

  it("waits for the Phase 6C sandbox executor to confirm stop before cleanup or finalization", async () => {
    const stopped = deferred<void>();
    const abortObserved = deferred<void>();
    const events: string[] = [];
    const cleanup = vi.fn(async () => {
      events.push("cleanup");
    });
    const finalize = vi.fn(async ({ terminal }: Parameters<WorkerSupervisorControlClient["finalize"]>[0]) => {
      events.push("finalize");
      return { outcome: terminal.outcome, replayed: false };
    });
    const repoControl = control({
      heartbeat: vi.fn(async () => ({ cancelRequested: true, leaseExpiresAt: "2026-08-27T02:01:00.000Z" })),
      finalize,
    });
    const executor: WorkerExecutor = {
      execute: vi.fn(async (_contract, signal) => {
        if (!signal.aborted) {
          await new Promise<void>((resolve) => {
            signal.addEventListener("abort", () => resolve(), { once: true });
          });
        }
        events.push("abort-observed");
        abortObserved.resolve();
        await stopped.promise;
        events.push("executor-stopped");
        throw new DOMException("sandbox stopped", "AbortError");
      }),
    };

    const execution = runWorkerOnce({
      control: repoControl,
      executor,
      repositoryScanPreparer: preparer(cleanup),
      heartbeatMs: 1,
      now: () => Date.parse("2026-08-27T02:00:00.000Z"),
    });

    await abortObserved.promise;
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(cleanup).not.toHaveBeenCalled();
    expect(finalize).not.toHaveBeenCalled();

    stopped.resolve();
    await expect(execution).resolves.toEqual({ status: "completed", outcome: "cancelled", replayed: false });
    expect(events).toEqual(["abort-observed", "executor-stopped", "cleanup", "finalize"]);
  });
});