import type {
  WorkerTaskContract,
  WorkerTerminalEnvelope,
} from "@/packages/worker-contracts";
import type { RepositoryScanStagingArtifact } from "./repository-scan-stager";

export interface WorkerSupervisorControlClient {
  claim(): Promise<WorkerTaskContract | null>;
  repositoryScanArtifact?(input: {
    taskId: string;
    attemptId: string;
    leaseToken: string;
  }): Promise<RepositoryScanStagingArtifact>;
  repositoryScanFinalizeSuccess?(input: {
    taskId: string;
    attemptId: string;
    leaseToken: string;
    terminal: WorkerTerminalEnvelope;
  }): Promise<{ outcome: "succeeded"; replayed: boolean }>;
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
