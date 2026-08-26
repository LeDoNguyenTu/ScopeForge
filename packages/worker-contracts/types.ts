export type WorkerExecutionClass = "foundation_no_egress_v1";
export type WorkerNetworkPolicy = "none";
export type WorkerTerminalOutcome = "succeeded" | "failed" | "cancelled";
export type WorkerTerminalFailureCode =
  | "WORKER_LOST"
  | "WORKER_BUDGET_EXCEEDED"
  | "WORKER_OUTPUT_INVALID"
  | "WORKER_EXECUTION_FAILED"
  | "WORKER_CLASS_UNAVAILABLE";

export interface WorkerExecutionBudget {
  maxWallTimeMs: number;
  maxCpuTimeMs: number;
  maxMemoryBytes: number;
  maxProcesses: number;
  maxInputFiles: number;
  maxInputBytes: number;
  maxScratchBytes: number;
  maxOutputBytes: number;
}

export interface WorkerExecutionProfile {
  executionClass: WorkerExecutionClass;
  networkPolicy: WorkerNetworkPolicy;
  budget: WorkerExecutionBudget;
}

export interface FoundationProbeInput {
  kind: "foundation_probe";
  nonce: string;
}

export interface WorkerTaskContract {
  taskId: string;
  attemptId: string;
  executionClass: WorkerExecutionClass;
  leaseToken: string;
  absoluteDeadlineAt: string;
  budget: WorkerExecutionBudget;
  input: FoundationProbeInput;
}

export interface WorkerAttemptMetrics {
  wallTimeMs: number;
  cpuTimeMs: number;
  peakMemoryBytes: number;
  inputBytes: number;
  outputBytes: number;
}

export interface FoundationProbeResult {
  kind: "foundation_probe";
  nonceDigest: string;
}

export interface WorkerTerminalEnvelope {
  schemaVersion: 1;
  taskId: string;
  attemptId: string;
  executionClass: WorkerExecutionClass;
  outcome: WorkerTerminalOutcome;
  failureCode: WorkerTerminalFailureCode | null;
  metrics: WorkerAttemptMetrics;
  result: FoundationProbeResult | null;
}

export interface WorkerTerminalExpectation {
  taskId: string;
  attemptId: string;
  executionClass: WorkerExecutionClass;
}
