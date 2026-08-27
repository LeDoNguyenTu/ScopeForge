import type {
  WorkerExecutionBudget,
  WorkerExecutionClass,
  WorkerTaskInput,
  WorkerTerminalEnvelope,
} from "@/packages/worker-contracts";

export interface RepositoryScanPreparedInput {
  kind: "phase3_repository_scan_prepared";
  sourceDirectory: string;
  snapshotId: string;
  canonicalRepositoryUrl: string;
  resolvedCommitSha: string;
  contentDigest: string;
  scannerProfileId: "phase3-hosted-static-v1";
  scannerProfileVersion: 1;
  retainedBytes: number;
}

export interface WorkerExecutorContract {
  taskId: string;
  attemptId: string;
  executionClass: WorkerExecutionClass;
  absoluteDeadlineAt: string;
  budget: WorkerExecutionBudget;
  input: WorkerTaskInput | RepositoryScanPreparedInput;
}

export interface WorkerExecutor {
  execute(
    contract: WorkerExecutorContract,
    signal: AbortSignal,
  ): Promise<WorkerTerminalEnvelope>;
}

export interface WorkerExecutorDispatcherDependencies {
  foundation: WorkerExecutor;
  repositorySnapshot: WorkerExecutor;
  repositoryScan: WorkerExecutor;
}

export function createWorkerExecutorDispatcher(
  dependencies: WorkerExecutorDispatcherDependencies,
): WorkerExecutor {
  return Object.freeze({
    execute(contract, signal) {
      switch (contract.executionClass) {
        case "foundation_no_egress_v1":
          return dependencies.foundation.execute(contract, signal);
        case "repository_snapshot_github_public_v1":
          return dependencies.repositorySnapshot.execute(contract, signal);
        case "phase3_repository_scan_no_egress_v1":
          return dependencies.repositoryScan.execute(contract, signal);
      }
      const unreachable: never = contract.executionClass;
      throw new Error(`Unsupported worker execution class: ${String(unreachable)}`);
    },
  });
}