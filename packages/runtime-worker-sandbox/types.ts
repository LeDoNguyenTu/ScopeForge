export type RuntimeWorkerExecutionClass =
  | "passive_runtime_observation_v1"
  | "active_cors_validation_v1";

export interface RuntimeWorkerPodmanCommandInput {
  taskId: string;
  attemptId: string;
  executionClass: RuntimeWorkerExecutionClass;
  mediatorSessionNonce: string;
  podmanBinary: string;
  image: string;
  mediatorSocketPath: string;
}

export interface RuntimeWorkerPodmanCreateCommand {
  file: string;
  args: readonly string[];
  containerName: string;
}

export interface RuntimeWorkerSandboxResult {
  output: string;
}

export interface RuntimeWorkerSandbox {
  execute(
    input: RuntimeWorkerPodmanCommandInput,
    signal: AbortSignal,
  ): Promise<RuntimeWorkerSandboxResult>;
}
