import { createHash } from "node:crypto";
import {
  validateWorkerTerminalEnvelope,
  type WorkerTaskContract,
  type WorkerTerminalEnvelope,
} from "@/packages/worker-contracts";
import type { WorkerSupervisorControlClient } from "./control-client";
import type { WorkerExecutor, WorkerExecutorContract } from "./executor";
import type { RepositoryScanPreparer } from "./repository-scan";

export interface WorkerSupervisorDependencies {
  control: WorkerSupervisorControlClient;
  executor: WorkerExecutor;
  repositoryScanPreparer?: RepositoryScanPreparer;
  heartbeatMs?: number;
  now?: () => number;
}

type StopReason = "cancelled" | "lost" | "budget" | null;

function executorContract(task: WorkerTaskContract): WorkerExecutorContract {
  if (task.executionClass === "phase3_repository_scan_no_egress_v1") {
    throw new Error("Phase 6C tasks must be prepared before executor dispatch.");
  }
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

function successfulOutputMatchesTask(
  task: WorkerTaskContract,
  terminal: WorkerTerminalEnvelope,
): boolean {
  if (task.executionClass === "foundation_no_egress_v1") {
    return task.input.kind === "foundation_probe"
      && terminal.result?.kind === "foundation_probe"
      && terminal.result.nonceDigest === foundationProbeDigest(task.input.nonce);
  }
  if (task.executionClass === "repository_snapshot_github_public_v1") {
    return task.input.kind === "repository_snapshot_github_public"
      && terminal.result?.kind === "repository_snapshot_github_public"
      && terminal.result.canonicalRepositoryUrl === task.input.canonicalRepositoryUrl;
  }
  if (task.executionClass === "phase3_repository_scan_no_egress_v1") {
    return task.input.kind === "phase3_repository_scan"
      && terminal.result?.kind === "phase3_repository_scan"
      && terminal.result.snapshotId === task.input.snapshotId
      && terminal.result.canonicalRepositoryUrl === task.input.canonicalRepositoryUrl
      && terminal.result.resolvedCommitSha === task.input.resolvedCommitSha
      && terminal.result.contentDigest === task.input.contentDigest
      && terminal.result.scannerProfileId === task.input.scannerProfileId
      && terminal.result.scannerProfileVersion === task.input.scannerProfileVersion;
  }
  return false;
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
    if (terminal.outcome === "succeeded" && !successfulOutputMatchesTask(task, terminal)) {
      return failureTerminal(task, "WORKER_OUTPUT_INVALID");
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

async function executePreparedTask(
  task: WorkerTaskContract,
  executor: WorkerExecutor,
  contract: WorkerExecutorContract,
  signal: AbortSignal,
): Promise<unknown> {
  if (task.executionClass === "phase3_repository_scan_no_egress_v1") {
    // Phase 6C owns a killable external sandbox. Do not detach on abort: the
    // executor resolves/rejects only after Podman has stopped or cleanup fails
    // closed, so staged source and lease finalization cannot race live hostile work.
    return executor.execute(contract, signal);
  }
  return executeWithinSupervisorBoundary(executor, contract, signal);
}

async function preparedExecutorContract(
  task: WorkerTaskContract,
  dependencies: WorkerSupervisorDependencies,
  signal: AbortSignal,
): Promise<{ contract: WorkerExecutorContract; cleanup: (() => Promise<void>) | null }> {
  if (task.executionClass !== "phase3_repository_scan_no_egress_v1") {
    return { contract: executorContract(task), cleanup: null };
  }
  if (task.input.kind !== "phase3_repository_scan") {
    throw new Error("Phase 6C claim input is invalid.");
  }
  const artifactAccess = dependencies.control.repositoryScanArtifact;
  const preparer = dependencies.repositoryScanPreparer;
  if (!artifactAccess || !preparer) {
    throw new Error("Phase 6C preparation authority is unavailable.");
  }
  const artifact = await artifactAccess({
    taskId: task.taskId,
    attemptId: task.attemptId,
    leaseToken: task.leaseToken,
  });
  if (signal.aborted) {
    throw new DOMException("Phase 6C preparation was aborted.", "AbortError");
  }
  const prepared = await preparer.prepare({ task, artifact, signal });
  return { contract: prepared.contract, cleanup: prepared.cleanup };
}

async function finalizeThroughTrustedBoundary(
  task: WorkerTaskContract,
  terminal: WorkerTerminalEnvelope,
  control: WorkerSupervisorControlClient,
): Promise<{ outcome: "succeeded" | "failed" | "cancelled"; replayed: boolean }> {
  if (task.executionClass === "phase3_repository_scan_no_egress_v1" && terminal.outcome === "succeeded") {
    const finalizeSuccess = control.repositoryScanFinalizeSuccess;
    if (!finalizeSuccess) {
      throw new Error("Phase 6C success publication authority is unavailable.");
    }
    return finalizeSuccess({
      taskId: task.taskId,
      attemptId: task.attemptId,
      leaseToken: task.leaseToken,
      terminal,
    });
  }

  return control.finalize({
    leaseToken: task.leaseToken,
    terminal,
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
  let cleanup: (() => Promise<void>) | null = null;
  let cleanupFailed = false;
  try {
    const prepared = await preparedExecutorContract(task, dependencies, abortController.signal);
    cleanup = prepared.cleanup;
    const raw = await executePreparedTask(
      task,
      dependencies.executor,
      prepared.contract,
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
    if (cleanup) {
      try {
        await cleanup();
      } catch {
        cleanupFailed = true;
      }
    }
    clearTimeout(timeout);
    clearInterval(heartbeatTimer);
  }

  if (stopReason === "cancelled") {
    terminal = cancelledTerminal(task, terminal);
  } else if (stopReason === "lost") {
    terminal = failureTerminal(task, "WORKER_LOST");
  } else if (stopReason === "budget") {
    terminal = failureTerminal(task, "WORKER_BUDGET_EXCEEDED");
  } else if (cleanupFailed) {
    terminal = failureTerminal(task, "WORKER_EXECUTION_FAILED");
  }

  const finalization = await finalizeThroughTrustedBoundary(task, terminal, dependencies.control);

  return Object.freeze({
    status: "completed" as const,
    outcome: finalization.outcome,
    replayed: finalization.replayed,
  });
}