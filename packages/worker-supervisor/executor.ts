import type {
  WorkerTaskContract,
  WorkerTerminalEnvelope,
} from "@/packages/worker-contracts";

export type WorkerExecutorContract = Omit<WorkerTaskContract, "leaseToken">;

export interface WorkerExecutor {
  execute(
    contract: WorkerExecutorContract,
    signal: AbortSignal,
  ): Promise<WorkerTerminalEnvelope>;
}

export interface WorkerExecutorDispatcherDependencies {
  foundation: WorkerExecutor;
  repositorySnapshot: WorkerExecutor;
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
      }
      const unreachable: never = contract.executionClass;
      throw new Error(`Unsupported worker execution class: ${String(unreachable)}`);
    },
  });
}
