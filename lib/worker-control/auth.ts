import type { WorkerNodeIdentity } from "./types";

export class WorkerBrokerAuthError extends Error {
  readonly code = "WORKER_AUTHENTICATION_FAILED" as const;

  constructor() {
    super("WORKER_AUTHENTICATION_FAILED");
    this.name = "WorkerBrokerAuthError";
  }
}

export interface WorkerBrokerAuthDependencies {
  authenticate(input: { workerId: string; secret: string }): Promise<WorkerNodeIdentity>;
}

export async function authenticateWorkerRequest(
  request: Request,
  dependencies: WorkerBrokerAuthDependencies,
): Promise<WorkerNodeIdentity> {
  const workerId = request.headers.get("x-scopeforge-worker-id")?.trim() ?? "";
  const authorization = request.headers.get("authorization") ?? "";

  if (workerId.length < 1 || workerId.length > 64 || authorization.length > 80) {
    throw new WorkerBrokerAuthError();
  }
  const match = /^Bearer ([a-f0-9]{64})$/.exec(authorization);
  if (!match) throw new WorkerBrokerAuthError();

  try {
    return await dependencies.authenticate({ workerId, secret: match[1] as string });
  } catch {
    throw new WorkerBrokerAuthError();
  }
}
