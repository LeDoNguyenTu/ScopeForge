import type {
  WorkerTaskContract,
  WorkerTerminalEnvelope,
} from "@/packages/worker-contracts";
import type {
  AuthorizedRuntimeTarget,
  RuntimeObservationBudget,
} from "@/packages/runtime-observer";
import type {
  ActiveValidationBudget,
  AuthorizedValidationTarget,
} from "@/packages/runtime-validator";
import type { RepositoryScanStagingArtifact } from "./repository-scan-stager";

export interface PreparedPassiveRuntimeWorkerExecution {
  taskId: string;
  attemptId: string;
  executionClass: "passive_runtime_observation_v1";
  domainJobId: string;
  expiresAt: string;
  target: AuthorizedRuntimeTarget;
  budget: Readonly<RuntimeObservationBudget>;
}

export interface PreparedActiveCorsWorkerExecution {
  taskId: string;
  attemptId: string;
  executionClass: "active_cors_validation_v1";
  domainJobId: string;
  expiresAt: string;
  target: AuthorizedValidationTarget;
  budget: Readonly<ActiveValidationBudget>;
}

export type PreparedRuntimeWorkerExecution =
  | PreparedPassiveRuntimeWorkerExecution
  | PreparedActiveCorsWorkerExecution;

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
  runtimePrepare?(input: {
    taskId: string;
    attemptId: string;
    leaseToken: string;
  }): Promise<PreparedRuntimeWorkerExecution>;
  runtimeFinalize?(input: {
    taskId: string;
    attemptId: string;
    leaseToken: string;
    terminal: WorkerTerminalEnvelope;
  }): Promise<{ outcome: "succeeded" | "failed" | "cancelled"; replayed: boolean }>;
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
