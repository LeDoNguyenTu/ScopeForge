import { createHash } from "node:crypto";
import {
  validateWorkerTerminalEnvelope,
  type WorkerTaskContract,
  type WorkerTerminalEnvelope,
} from "@/packages/worker-contracts";
import type { WorkerSupervisorControlClient } from "./control-client";
import type { WorkerExecutor, WorkerExecutorContract } from "./executor";
import type { RepositoryScanPreparer } from "./repository-scan";
import type { RuntimeNetworkPreparer } from "./runtime-network";

export interface WorkerSupervisorDependencies {
  control: WorkerSupervisorControlClient;
  executor: WorkerExecutor;
  repositoryScanPreparer?: RepositoryScanPreparer;
  runtimeNetworkPreparer?: RuntimeNetworkPreparer;
  heartbeatMs?: number;
  now?: () => number;
}

type StopReason = "cancelled" | "lost" | "budget" | null;

type RuntimeExecutionClass =
  | "passive_runtime_observation_v1"
  | "active_cors_validation_v1";

function isRuntimeExecutionClass(
  executionClass: WorkerTaskContract["executionClass"],
): executionClass is RuntimeExecutionClass {
  return executionClass === "passive_runtime_observation_v1"
    || executionClass === "active_cors_validation_v1";
}

function executorContract(task: WorkerTaskContract): WorkerExecutorContract {
  if (task.executionClass === "phase3_repository_scan_no_egress_v1") {
    throw new Error("Phase 6C tasks must be prepared before executor dispatch.");
  }
  if (isRuntimeExecutionClass(task.executionClass)) {
    throw new Error("Phase 6D tasks must be prepared before executor dispatch.");
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
      && terminal.result.artifactDigest === task.input.artifactDigest
      && terminal.result.scannerProfileId === task.input.scannerProfileId
      && terminal.result.scannerProfileVersion === task.input.scannerProfileVersion;
  }
  if (task.executionClass === "passive_runtime_observation_v1") {
    return task.input.kind === "passive_runtime_observation"
      && terminal.result?.kind === "passive_runtime_observation";
  }
  if (task.executionClass === "active_cors_validation_v1") {
    return task.input.kind === "active_cors_validation"
      && terminal.result?.kind === "active_cors_validation";
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
  if (task.executionClass === "phase3_repository_scan_no_egress_v1"
      || isRuntimeExecutionClass(task.executionClass)) {
    // Phase 6C and Phase 6D own killable external sandboxes. Do not detach on
    // abort: the executor resolves/rejects only after hostile work has stopped,
    // so cleanup and trusted finalization cannot race a still-running process.
    return executor.execute(contract, signal);
  }
  return executeWithinSupervisorBoundary(executor, contract, signal);
}

async function prepareRepositoryScanTask(
  task: WorkerTaskContract,
  dependencies: WorkerSupervisorDependencies,
  signal: AbortSignal,
): Promise<{ contract: WorkerExecutorContract; cleanup: (() => Promise<void>) | null }> {
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

async function prepareRuntimeTask(
  task: WorkerTaskContract,
  dependencies: WorkerSupervisorDependencies,
  signal: AbortSignal,
  isCancelled: () => Promise<boolean>,
): Promise<{ contract: WorkerExecutorContract; cleanup: (() => Promise<void>) | null }> {
  const inputMatchesClass =
    (task.executionClass === "passive_runtime_observation_v1"
      && task.input.kind === "passive_runtime_observation")
    || (task.executionClass === "active_cors_validation_v1"
      && task.input.kind === "active_cors_validation");
  if (!inputMatchesClass) {
    throw new Error("Phase 6D claim input is invalid.");
  }

  const prepare = dependencies.control.runtimePrepare;
  const preparer = dependencies.runtimeNetworkPreparer;
  if (!prepare || !preparer) {
    throw new Error("Phase 6D preparation authority is unavailable.");
  }

  const preparedProfile = await prepare({
    taskId: task.taskId,
    attemptId: task.attemptId,
    leaseToken: task.leaseToken,
  });
  if (signal.aborted) {
    throw new DOMException("Phase 6D preparation was aborted.", "AbortError");
  }
  const prepared = await preparer.prepare({
    task,
    prepared: preparedProfile,
    signal,
    isCancelled,
  });
  return { contract: prepared.contract, cleanup: prepared.cleanup };
}

async function preparedExecutorContract(
  task: WorkerTaskContract,
  dependencies: WorkerSupervisorDependencies,
  signal: AbortSignal,
  runtimeIsCancelled: () => Promise<boolean>,
): Promise<{ contract: WorkerExecutorContract; cleanup: (() => Promise<void>) | null }> {
  if (task.executionClass === "phase3_repository_scan_no_egress_v1") {
    return prepareRepositoryScanTask(task, dependencies, signal);
  }
  if (isRuntimeExecutionClass(task.executionClass)) {
    return prepareRuntimeTask(task, dependencies, signal, runtimeIsCancelled);
  }
  return { contract: executorContract(task), cleanup: null };
}

async function finalizeThroughTrustedBoundary(
  task: WorkerTaskContract,
  terminal: WorkerTerminalEnvelope,
  control: WorkerSupervisorControlClient,
): Promise<{ outcome: "succeeded" | "failed" | "cancelled"; replayed: boolean }> {
  if (isRuntimeExecutionClass(task.executionClass)) {
    const finalizeRuntime = control.runtimeFinalize;
    if (!finalizeRuntime) {
      throw new Error("Phase 6D finalization authority is unavailable.");
    }
    return finalizeRuntime({
      taskId: task.taskId,
      attemptId: task.attemptId,
      leaseToken: task.leaseToken,
      terminal,
    });
  }

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
  let heartbeatInFlight: Promise<boolean> | null = null;

  const timeout = setTimeout(() => {
    if (!abortController.signal.aborted) {
      stopReason = "budget";
      abortController.abort();
    }
  }, executionTimeoutMs(task, now));

  const performHeartbeat = (): Promise<boolean> => {
    if (heartbeatInFlight) return heartbeatInFlight;

    const request = dependencies.control.heartbeat({
      taskId: task.taskId,
      attemptId: task.attemptId,
      leaseToken: task.leaseToken,
    }).then((heartbeat) => {
      consecutiveHeartbeatFailures = 0;
      if (heartbeat.cancelRequested && !abortController.signal.aborted) {
        stopReason = "cancelled";
        abortController.abort();
      }
      return heartbeat.cancelRequested;
    }).catch((error: unknown) => {
      consecutiveHeartbeatFailures += 1;
      throw error;
    });

    heartbeatInFlight = request;
    void request.then(
      () => {
        if (heartbeatInFlight === request) heartbeatInFlight = null;
      },
      () => {
        if (heartbeatInFlight === request) heartbeatInFlight = null;
      },
    );
    return request;
  };

  const authoritativeRuntimeCancellationProbe = async (): Promise<boolean> => {
    if (stopReason === "cancelled") return true;
    if (abortController.signal.aborted) return false;

    try {
      return await performHeartbeat();
    } catch (error) {
      if (!abortController.signal.aborted) {
        stopReason = "lost";
        abortController.abort();
      }
      throw error;
    }
  };

  const heartbeatTimer = setInterval(() => {
    if (abortController.signal.aborted) return;
    void performHeartbeat().catch(() => {
      if (consecutiveHeartbeatFailures >= 2 && !abortController.signal.aborted) {
        stopReason = "lost";
        abortController.abort();
      }
    });
  }, heartbeatMs);

  let terminal: WorkerTerminalEnvelope;
  let cleanup: (() => Promise<void>) | null = null;
  let cleanupFailed = false;
  try {
    const prepared = await preparedExecutorContract(
      task,
      dependencies,
      abortController.signal,
      authoritativeRuntimeCancellationProbe,
    );
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
