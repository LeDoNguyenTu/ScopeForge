export interface WorkerRecoveryDependencies {
  recover(nowIso: string): Promise<number>;
  now?: () => Date;
}

export async function recoverExpiredWorkerAttempts(
  dependencies: WorkerRecoveryDependencies,
): Promise<number> {
  const now = (dependencies.now ?? (() => new Date()))();
  return dependencies.recover(now.toISOString());
}
