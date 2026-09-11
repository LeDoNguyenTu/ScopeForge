import { describe, expect, it, vi } from "vitest";
import {
  finalizePrivateRepositorySnapshotFailureAttempt,
  type WorkerControlRepository,
} from "@/lib/worker-control/service";

const WORKER_ID = "11111111-1111-4111-8111-111111111111";
const TASK_ID = "22222222-2222-4222-8222-222222222222";
const ATTEMPT_ID = "33333333-3333-4333-8333-333333333333";
const LEASE_TOKEN = "a".repeat(64);

function metrics() {
  return {
    wallTimeMs: 100,
    cpuTimeMs: 50,
    peakMemoryBytes: 1024,
    inputBytes: 4096,
    outputBytes: 256,
  };
}

function dependencies() {
  const finalize = vi.fn(async (input) => ({
    taskId: input.taskId,
    attemptId: input.attemptId,
    outcome: input.terminalOutcome,
    replayed: false,
  }));
  return {
    finalize,
    value: {
      repository: { finalize } as unknown as WorkerControlRepository,
    },
  };
}

describe("private repository snapshot failure finalization", () => {
  it("persists a closed private acquisition failure for retry/recovery", async () => {
    const deps = dependencies();
    const terminal = {
      schemaVersion: 1 as const,
      taskId: TASK_ID,
      attemptId: ATTEMPT_ID,
      executionClass: "repository_snapshot_github_private_v1" as const,
      outcome: "failed" as const,
      failureCode: "REPOSITORY_UNAVAILABLE" as const,
      metrics: metrics(),
      result: null,
    };

    await expect(finalizePrivateRepositorySnapshotFailureAttempt({
      workerId: WORKER_ID,
      leaseToken: LEASE_TOKEN,
      terminal,
    }, deps.value)).resolves.toEqual({
      taskId: TASK_ID,
      attemptId: ATTEMPT_ID,
      outcome: "failed",
      replayed: false,
    });

    expect(deps.finalize).toHaveBeenCalledWith(expect.objectContaining({
      workerId: WORKER_ID,
      taskId: TASK_ID,
      attemptId: ATTEMPT_ID,
      leaseToken: LEASE_TOKEN,
      terminalOutcome: "failed",
      failureCode: "REPOSITORY_UNAVAILABLE",
      terminalPayloadDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
  });

  it("persists cancellation with no fabricated failure code", async () => {
    const deps = dependencies();
    await finalizePrivateRepositorySnapshotFailureAttempt({
      workerId: WORKER_ID,
      leaseToken: LEASE_TOKEN,
      terminal: {
        schemaVersion: 1,
        taskId: TASK_ID,
        attemptId: ATTEMPT_ID,
        executionClass: "repository_snapshot_github_private_v1",
        outcome: "cancelled",
        failureCode: null,
        metrics: metrics(),
        result: null,
      },
    }, deps.value);

    expect(deps.finalize).toHaveBeenCalledWith(expect.objectContaining({
      terminalOutcome: "cancelled",
      failureCode: null,
    }));
  });

  it("refuses to route a successful private snapshot through generic finalization", async () => {
    const deps = dependencies();
    await expect(finalizePrivateRepositorySnapshotFailureAttempt({
      workerId: WORKER_ID,
      leaseToken: LEASE_TOKEN,
      terminal: {
        schemaVersion: 1,
        taskId: TASK_ID,
        attemptId: ATTEMPT_ID,
        executionClass: "repository_snapshot_github_private_v1",
        outcome: "succeeded",
        failureCode: null,
        metrics: metrics(),
        result: { kind: "repository_snapshot_github_private" },
      },
    }, deps.value)).rejects.toMatchObject({ code: "REPOSITORY_SNAPSHOT_PUBLICATION_REQUIRED" });
    expect(deps.finalize).not.toHaveBeenCalled();
  });
});
