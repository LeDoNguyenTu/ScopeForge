import type {
  WorkerExecutionBudget,
  WorkerExecutionClass,
  WorkerTaskInput,
  WorkerTerminalEnvelope,
} from "@/packages/worker-contracts";
import type { RuntimeMediatorSessionIdentity } from "@/packages/runtime-worker-mediator/contracts";

export interface RepositoryScanPreparedInput {
  kind: "phase3_repository_scan_prepared";
  sourceDirectory: string;
  snapshotId: string;
  canonicalRepositoryUrl: string;
  resolvedCommitSha: string;
  contentDigest: string;
  artifactDigest: string;
  scannerProfileId: "phase3-hosted-static-v1";
  scannerProfileVersion: 1;
  retainedBytes: number;
}

export interface RuntimeWorkerPreparedInput {
  kind: "runtime_worker_prepared";
  domainJobId: string;
  mediatorSocketPath: string;
  mediatorSession: RuntimeMediatorSessionIdentity;
}

export interface WorkerExecutorContract {
  taskId: string;
  attemptId: string;
  executionClass: WorkerExecutionClass;
  absoluteDeadlineAt: string;
  budget: WorkerExecutionBudget;
  input: WorkerTaskInput | RepositoryScanPreparedInput | RuntimeWorkerPreparedInput;
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
  passiveRuntime?: WorkerExecutor;
  activeCors?: WorkerExecutor;
}

function requiredRuntimeExecutor(
  executor: WorkerExecutor | undefined,
  executionClass: "passive_runtime_observation_v1" | "active_cors_validation_v1",
): WorkerExecutor {
  if (!executor) throw new Error(`Worker executor is unavailable for ${executionClass}.`);
  return executor;
}

export function createWorkerExecutorDispatcher(
  dependencies: WorkerExecutorDispatcherDependencies,
): WorkerExecutor {
  const dispatcher: WorkerExecutor = {
    execute(contract, signal) {
      switch (contract.executionClass) {
        case "foundation_no_egress_v1":
          return dependencies.foundation.execute(contract, signal);
        case "repository_snapshot_github_public_v1":
          return dependencies.repositorySnapshot.execute(contract, signal);
        case "phase3_repository_scan_no_egress_v1":
          return dependencies.repositoryScan.execute(contract, signal);
        case "passive_runtime_observation_v1":
          return requiredRuntimeExecutor(dependencies.passiveRuntime, contract.executionClass).execute(contract, signal);
        case "active_cors_validation_v1":
          return requiredRuntimeExecutor(dependencies.activeCors, contract.executionClass).execute(contract, signal);
      }
      const unreachable: never = contract.executionClass;
      throw new Error(`Unsupported worker execution class: ${String(unreachable)}`);
    },
  };
  return Object.freeze(dispatcher);
}
