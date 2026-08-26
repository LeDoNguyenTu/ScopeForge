export interface PodmanSandboxCommandInput {
  podmanBinary: string;
  image: string;
  taskId: string;
  attemptId: string;
  sourceDirectory: string;
  taskMetadataPath: string;
}

export interface PodmanSandboxExecutionInput extends PodmanSandboxCommandInput {
  workDirectory: string;
}

export interface PodmanCreateCommand {
  file: string;
  args: string[];
  containerName: string;
}

export interface PodmanCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface PodmanCommandOptions {
  timeoutMs?: number;
  maxOutputBytes?: number;
}

export interface PodmanCommandDriver {
  exec(
    file: string,
    args: readonly string[],
    options?: PodmanCommandOptions,
  ): Promise<PodmanCommandResult>;
}

export interface PodmanSandboxResult {
  containerName: string;
  resultPath: string;
}

export interface PodmanSandbox {
  execute(
    input: PodmanSandboxExecutionInput,
    signal: AbortSignal,
  ): Promise<PodmanSandboxResult>;
}