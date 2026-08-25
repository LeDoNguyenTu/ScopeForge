import type {
  WorkerTaskContract,
  WorkerTerminalEnvelope,
} from "@/packages/worker-contracts";

export interface WorkerSupervisorControlClient {
  claim(): Promise<WorkerTaskContract | null>;
  heartbeat(input: {
    taskId: string;
    attemptId: string;
    leaseToken: string;
  }): Promise<{ cancelRequested: boolean; leaseExpiresAt: string }>;
  finalize(input: {
    leaseToken: string;
    terminal: WorkerTerminalEnvelope;
  }): Promise<{ outcome: "succeeded" | "failed" | "cancelled"; replayed: boolean }>;
}
