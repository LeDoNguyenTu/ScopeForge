export type RuntimeWorkerErrorCode =
  | "RUNTIME_WORKER_UNAVAILABLE"
  | "RUNTIME_WORKER_BUSY"
  | "RUNTIME_WORKER_TASK_INVALID";

export class RuntimeWorkerError extends Error {
  readonly code: RuntimeWorkerErrorCode;

  constructor(code: RuntimeWorkerErrorCode) {
    super(code);
    this.name = "RuntimeWorkerError";
    this.code = code;
  }
}
