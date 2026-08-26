import { WorkerBrokerAuthError } from "./auth";
import { WorkerControlError } from "./types";
import { WorkerTransportError } from "./transport";

function statusForControlError(code: WorkerControlError["code"]): number {
  switch (code) {
    case "WORKER_AUTHENTICATION_FAILED":
      return 401;
    case "WORKER_DISABLED":
    case "WORKER_NOT_AVAILABLE":
      return 403;
    case "WORKER_LEASE_INVALID":
      return 409;
    case "WORKER_TERMINAL_CONFLICT":
    case "WORKER_JOB_STATE_CONFLICT":
      return 409;
    case "WORKER_CREDENTIAL_INVALID":
    case "WORKER_VERSION_INVALID":
    case "WORKER_TERMINAL_INVALID":
    case "WORKER_BUDGET_EXCEEDED":
    case "WORKER_PROBE_ACCESS_DENIED":
    case "WORKER_PROBE_ASSET_MISMATCH":
      return 400;
    case "WORKER_CREDENTIAL_CONFLICT":
      return 409;
    default:
      return 500;
  }
}

export function workerJson(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function workerRouteError(error: unknown): Response {
  if (error instanceof WorkerBrokerAuthError) {
    return workerJson({ error: { code: error.code } }, 401);
  }
  if (error instanceof WorkerTransportError) {
    return workerJson({ error: { code: error.code } }, error.status);
  }
  if (error instanceof WorkerControlError) {
    return workerJson({ error: { code: error.code } }, statusForControlError(error.code));
  }
  return workerJson({ error: { code: "WORKER_REQUEST_FAILED" } }, 500);
}
