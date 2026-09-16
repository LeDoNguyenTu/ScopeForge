export interface WorkerLoopDependencies {
  runOnce(): Promise<{ status: "idle" } | { status: "completed"; outcome: string; replayed: boolean }>;
  signal: AbortSignal;
  pollMs: number;
  log?: (event: Readonly<{ event: string; code?: string; outcome?: string }>) => void;
}

function safeCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(code)) return code;
  }
  return "WORKER_RUNTIME_FAILED";
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(finish, ms);
    function finish() {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    }
    signal.addEventListener("abort", finish, { once: true });
  });
}

export async function runWorkerLoop(dependencies: WorkerLoopDependencies): Promise<void> {
  while (!dependencies.signal.aborted) {
    try {
      const result = await dependencies.runOnce();
      if (result.status === "completed") {
        dependencies.log?.({ event: "worker_iteration_completed", outcome: result.outcome });
        continue;
      }
    } catch (error) {
      dependencies.log?.({ event: "worker_iteration_failed", code: safeCode(error) });
    }
    if (!dependencies.signal.aborted) await wait(dependencies.pollMs, dependencies.signal);
  }
}
