import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  claimWorkerTask,
  finalizeWorkerAttempt,
  registerWorkerNode,
  type WorkerControlRepository,
} from "@/lib/worker-control/service";

function repository(overrides: Partial<WorkerControlRepository> = {}): WorkerControlRepository {
  return {
    register: vi.fn(async () => ({
      workerId: "11111111-1111-4111-8111-111111111111",
      executionClass: "foundation_no_egress_v1",
      softwareVersion: "0.1.0",
    })),
    disable: vi.fn(async () => ({ workerId: "11111111-1111-4111-8111-111111111111", disabledAt: "2026-08-26T00:00:00.000Z" })),
    authenticate: vi.fn(async () => ({
      workerId: "11111111-1111-4111-8111-111111111111",
      executionClass: "foundation_no_egress_v1",
      softwareVersion: "0.1.0",
    })),
    enqueueFoundationProbe: vi.fn(async () => ({
      scanJobId: "22222222-2222-4222-8222-222222222222",
      taskId: "33333333-3333-4333-8333-333333333333",
      executionClass: "foundation_no_egress_v1",
      absoluteDeadlineAt: "2026-08-26T00:05:00.000Z",
    })),
    claim: vi.fn(async () => null),
    heartbeat: vi.fn(async () => ({ cancelRequested: false, leaseExpiresAt: "2026-08-26T00:01:30.000Z" })),
    finalize: vi.fn(async () => ({
      taskId: "33333333-3333-4333-8333-333333333333",
      attemptId: "44444444-4444-4444-8444-444444444444",
      outcome: "succeeded",
      replayed: false,
    })),
    recover: vi.fn(async () => 0),
    ...overrides,
  };
}

describe("worker control service", () => {
  it("generates the worker secret once and persists only its digest", async () => {
    const repo = repository();
    const rawSecret = Buffer.alloc(32, 7);
    const result = await registerWorkerNode({ softwareVersion: "0.1.0" }, {
      repository: repo,
      randomBytes: () => rawSecret,
    });

    const expectedSecret = rawSecret.toString("hex");
    expect(result.secret).toBe(expectedSecret);
    expect(repo.register).toHaveBeenCalledWith({
      credentialHash: createHash("sha256").update(expectedSecret, "utf8").digest("hex"),
      softwareVersion: "0.1.0",
    });
    expect(JSON.stringify(vi.mocked(repo.register).mock.calls)).not.toContain(expectedSecret);
  });

  it("derives claim authority entirely from authenticated worker identity", async () => {
    const claim = vi.fn(async () => null);
    const repo = repository({ claim });
    await claimWorkerTask({ workerId: "11111111-1111-4111-8111-111111111111" }, { repository: repo });
    expect(claim).toHaveBeenCalledWith({ workerId: "11111111-1111-4111-8111-111111111111" });
  });

  it("validates and hashes terminal content before repository finalization", async () => {
    const finalize = vi.fn(async (input) => ({
      taskId: input.taskId,
      attemptId: input.attemptId,
      outcome: input.terminalOutcome,
      replayed: false,
    }));
    const repo = repository({ finalize });
    const terminal = {
      schemaVersion: 1,
      taskId: "33333333-3333-4333-8333-333333333333",
      attemptId: "44444444-4444-4444-8444-444444444444",
      executionClass: "foundation_no_egress_v1",
      outcome: "succeeded",
      failureCode: null,
      metrics: {
        wallTimeMs: 10,
        cpuTimeMs: 5,
        peakMemoryBytes: 1024,
        inputBytes: 8,
        outputBytes: 64,
      },
      result: { kind: "foundation_probe", nonceDigest: "a".repeat(64) },
    };

    await finalizeWorkerAttempt({
      workerId: "11111111-1111-4111-8111-111111111111",
      leaseToken: "b".repeat(64),
      terminal,
    }, { repository: repo });

    const persisted = finalize.mock.calls[0]?.[0];
    expect(persisted?.terminalPayloadDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(persisted).toMatchObject({
      workerId: "11111111-1111-4111-8111-111111111111",
      taskId: terminal.taskId,
      attemptId: terminal.attemptId,
      leaseToken: "b".repeat(64),
      terminalOutcome: "succeeded",
      failureCode: null,
      wallTimeMs: 10,
      cpuTimeMs: 5,
      peakMemoryBytes: 1024,
      inputBytes: 8,
      outputBytes: 64,
    });
    expect(persisted).not.toHaveProperty("command");
    expect(persisted).not.toHaveProperty("networkPolicy");
  });

  it("rejects unexpected terminal fields before persistence", async () => {
    const repo = repository();
    await expect(finalizeWorkerAttempt({
      workerId: "11111111-1111-4111-8111-111111111111",
      leaseToken: "b".repeat(64),
      terminal: {
        schemaVersion: 1,
        taskId: "33333333-3333-4333-8333-333333333333",
        attemptId: "44444444-4444-4444-8444-444444444444",
        executionClass: "foundation_no_egress_v1",
        outcome: "succeeded",
        failureCode: null,
        metrics: { wallTimeMs: 1, cpuTimeMs: 1, peakMemoryBytes: 1, inputBytes: 0, outputBytes: 0 },
        result: { kind: "foundation_probe", nonceDigest: "a".repeat(64) },
        url: "https://example.com",
      },
    }, { repository: repo })).rejects.toThrow(/unexpected/i);
    expect(repo.finalize).not.toHaveBeenCalled();
  });
});
