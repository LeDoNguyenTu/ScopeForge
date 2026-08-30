export interface RuntimeWorkerPodmanCommandInput {
  taskId: string;
  attemptId: string;
  podmanBinary: string;
  image: string;
  mediatorSocketPath: string;
}

export interface RuntimeWorkerPodmanCreateCommand {
  file: string;
  args: readonly string[];
  containerName: string;
}
