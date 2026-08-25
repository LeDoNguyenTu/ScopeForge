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
