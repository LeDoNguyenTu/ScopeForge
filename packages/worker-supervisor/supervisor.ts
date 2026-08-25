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
}

type StopReason = "cancelled" | "lost" | null;

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
  code: "WORKER_LOST" | "WORKER_EXECUTION_FAILED" | "WORKER_OUTPUT_INVALID",
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

function canonicalTerminal(
  task: WorkerTaskContract,
  value: unknown,
): WorkerTerminalEnvelope {
  try {
    return validateWorkerTerminalEnvelope(value, {
      taskId: task.taskId,
      attemptId: task.attemptId,
      executionClass: task.executionClass,
    });
  } catch {
    return failureTerminal(task, "WORKER_OUTPUT_INVALID");
  }
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
  let stopReason: StopReason = null;
  let consecutiveHeartbeatFailures = 0;
  let heartbeatInFlight = false;

  const timer = setInterval(() => {
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
    const raw = await dependencies.executor.execute(
      executorContract(task),
      abortController.signal,
    );
    terminal = canonicalTerminal(task, raw);
  } catch {
    terminal = stopReason === "cancelled"
      ? cancelledTerminal(task)
      : stopReason === "lost"
        ? failureTerminal(task, "WORKER_LOST")
        : failureTerminal(task, "WORKER_EXECUTION_FAILED");
  } finally {
    clearInterval(timer);
  }

  if (stopReason === "cancelled") {
    terminal = cancelledTerminal(task, terminal);
  } else if (stopReason === "lost") {
    terminal = failureTerminal(task, "WORKER_LOST");
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
