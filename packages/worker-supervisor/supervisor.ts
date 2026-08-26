import { createHash } from "node:crypto";
import {
  validateWorkerTerminalEnvelope,
  type WorkerTaskContract,
  type WorkerTerminalEnvelope,
} from "@/packages/worker-contracts";
import type { WorkerSupervisorControlClient } from "./control-client";
import type { WorkerExecutor, WorkerExecutorContract } from "./executor";

export interface WorkerSupervisorDependencies {
  control: WorkerSupervisorControlClient;
  executor: WorkerExecutor;
  heartbeatMs?: number;
  now?: () => number;
}

type StopReason = "cancelled" | "lost" | "budget" | null;

function executorContract(task: WorkerTaskContract): WorkerExecutorContract {
  return Object.freeze({
    taskId: task.taskId,
    attemptId: task.attemptId,
    executionClass: task.executionClass,
    absoluteDeadlineAt: task.absoluteDeadlineAt,
    budget: task.budget,
    input: task.input,
  });
}

function failureTerminal(
  task: WorkerTaskContract,
  code: "WORKER_LOST" | "WORKER_EXECUTION_FAILED" | "WORKER_OUTPUT_INVALID" | "WORKER_BUDGET_EXCEEDED",
): WorkerTerminalEnvelope {
  return Object.freeze({
    schemaVersion: 1,
    taskId: task.taskId,
    attemptId: task.attemptId,
    executionClass: task.executionClass,
    outcome: "failed",
    failureCode: code,
    metrics: Object.freeze({
      wallTimeMs: 0,
      cpuTimeMs: 0,
      peakMemoryBytes: 0,
      inputBytes: 0,
      outputBytes: 0,
    }),
    result: null,
  });
}

function cancelledTerminal(
  task: WorkerTaskContract,
  prior?: WorkerTerminalEnvelope,
): WorkerTerminalEnvelope {
  return Object.freeze({
    schemaVersion: 1,
    taskId: task.taskId,
    attemptId: task.attemptId,
    executionClass: task.executionClass,
    outcome: "cancelled",
    failureCode: null,
    metrics: prior?.metrics ?? Object.freeze({
      wallTimeMs: 0,
      cpuTimeMs: 0,
      peakMemoryBytes: 0,
      inputBytes: 0,
      outputBytes: 0,
    }),
    result: null,
  });
}

function foundationProbeDigest(nonce: string): string {
  return createHash("sha256").update(nonce, "utf8").digest("hex");
}

function canonicalTerminal(
  task: WorkerTaskContract,
  value: unknown,
): WorkerTerminalEnvelope {
  try {
    const terminal = validateWorkerTerminalEnvelope(value, {
      taskId: task.taskId,
      attemptId: task.attemptId,
      executionClass: task.executionClass,
    });
    if (terminal.outcome === "succeeded") {
      if (terminal.result?.kind !== "foundation_probe"
          || terminal.result.nonceDigest !== foundationProbeDigest(task.input.nonce)) {
        return failureTerminal(task, "WORKER_OUTPUT_INVALID");
      }
    }
    return terminal;
  } catch {
    return failureTerminal(task, "WORKER_OUTPUT_INVALID");
  }
}

function executionTimeoutMs(
  task: WorkerTaskContract,
  now: () => number,
): number {
  const deadlineMs = Date.parse(task.absoluteDeadlineAt);
  if (!Number.isFinite(deadlineMs)) return 0;
  return Math.max(0, Math.min(task.budget.maxWallTimeMs, deadlineMs - now()));
}

function executeWithinSupervisorBoundary(
  executor: WorkerExecutor,
  contract: WorkerExecutorContract,
  signal: AbortSignal,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      callback();
    };

    const onAbort = () => {
      finish(() => reject(new Error("WORKER_EXECUTOR_ABORTED")));
    };

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener("abort", onAbort, { once: true });

    void executor.execute(contract, signal).then(
      (result) => finish(() => resolve(result)),
      (error: unknown) => finish(() => reject(error)),
    );
  });
}

export async function runWorkerOnce(
  dependencies: WorkerSupervisorDependencies,
): Promise<
  | { status: "idle" }
  | { status: "completed"; outcome: "succeeded" | "failed" | "cancelled"; replayed: boolean }
> {
  const task = await dependencies.control.claim();
  if (!task) return Object.freeze({ status: "idle" as const });

  const abortController = new AbortController();
  const heartbeatMs = Math.max(1, Math.trunc(dependencies.heartbeatMs ?? 30_000));
  const now = dependencies.now ?? Date.now;
  let stopReason: StopReason = null;
  let consecutiveHeartbeatFailures = 0;
  let heartbeatInFlight = false;

  const timeout = setTimeout(() => {
    if (!abortController.signal.aborted) {
      stopReason = "budget";
      abortController.abort();
    }
  }, executionTimeoutMs(task, now));

  const heartbeatTimer = setInterval(() => {
    if (heartbeatInFlight || abortController.signal.aborted) return;
    heartbeatInFlight = true;
    void dependencies.control.heartbeat({
      taskId: task.taskId,
      attemptId: task.attemptId,
      leaseToken: task.leaseToken,
    }).then((heartbeat) => {
      consecutiveHeartbeatFailures = 0;
      if (heartbeat.cancelRequested && !abortController.signal.aborted) {
        stopReason = "cancelled";
        abortController.abort();
      }
    }).catch(() => {
      consecutiveHeartbeatFailures += 1;
      if (consecutiveHeartbeatFailures >= 2 && !abortController.signal.aborted) {
        stopReason = "lost";
        abortController.abort();
      }
    }).finally(() => {
      heartbeatInFlight = false;
    });
  }, heartbeatMs);

  let terminal: WorkerTerminalEnvelope;
  try {
    const raw = await executeWithinSupervisorBoundary(
      dependencies.executor,
      executorContract(task),
      abortController.signal,
    );
    terminal = canonicalTerminal(task, raw);
  } catch {
    terminal = stopReason === "cancelled"
      ? cancelledTerminal(task)
      : stopReason === "lost"
        ? failureTerminal(task, "WORKER_LOST")
        : stopReason === "budget"
          ? failureTerminal(task, "WORKER_BUDGET_EXCEEDED")
          : failureTerminal(task, "WORKER_EXECUTION_FAILED");
  } finally {
    clearTimeout(timeout);
    clearInterval(heartbeatTimer);
  }

  if (stopReason === "cancelled") {
    terminal = cancelledTerminal(task, terminal);
  } else if (stopReason === "lost") {
    terminal = failureTerminal(task, "WORKER_LOST");
  } else if (stopReason === "budget") {
    terminal = failureTerminal(task, "WORKER_BUDGET_EXCEEDED");
  }

  const finalization = await dependencies.control.finalize({
    leaseToken: task.leaseToken,
    terminal,
  });

  return Object.freeze({
    status: "completed" as const,
    outcome: finalization.outcome,
    replayed: finalization.replayed,
  });
}
