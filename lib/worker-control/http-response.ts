import { RepositoryScanError } from "@/lib/repository-scans/types";
import { RepositorySnapshotError } from "@/lib/repository-snapshots/types";
import { writeSecurityTelemetry, type WorkerSecurityRoute } from "@/lib/security/telemetry";
import { WorkerBrokerAuthError } from "./auth";
import { WorkerControlError } from "./types";
import { WorkerTransportError } from "./transport";

function statusForControlError(code: WorkerControlError["code"]): number {
  switch (code) {
    case "WORKER_AUTHENTICATION_FAILED":
      return 401;
    case "WORKER_DISABLED":
    case "WORKER_NOT_AVAILABLE":
    case "RUNTIME_WORKER_ACCESS_DENIED":
      return 403;
    case "RUNTIME_WORKER_ACTIVE_LIMIT":
      return 429;
    case "WORKER_LEASE_INVALID":
    case "WORKER_TERMINAL_CONFLICT":
    case "WORKER_JOB_STATE_CONFLICT":
    case "RUNTIME_WORKER_TASK_INVALID":
    case "RUNTIME_WORKER_CLASS_MISMATCH":
    case "REPOSITORY_SNAPSHOT_PUBLICATION_REQUIRED":
    case "REPOSITORY_SCAN_PUBLICATION_REQUIRED":
    case "REPOSITORY_SCAN_ARTIFACT_NOT_AVAILABLE":
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

function statusForRepositorySnapshotError(code: RepositorySnapshotError["code"]): number {
  switch (code) {
    case "REPOSITORY_SNAPSHOT_REQUEST_INVALID":
    case "REPOSITORY_SNAPSHOT_ASSET_MISMATCH":
    case "REPOSITORY_SNAPSHOT_TERMINAL_INVALID":
      return 400;
    case "REPOSITORY_SNAPSHOT_ACCESS_DENIED":
    case "WORKER_DISABLED":
      return 403;
    case "REPOSITORY_SNAPSHOT_COOLDOWN":
    case "REPOSITORY_SNAPSHOT_DAILY_LIMIT":
    case "REPOSITORY_SNAPSHOT_ACTIVE_LIMIT":
      return 429;
    case "REPOSITORY_SNAPSHOT_ARTIFACT_NOT_AVAILABLE":
    case "REPOSITORY_SNAPSHOT_ARTIFACT_SIZE_MISMATCH":
    case "REPOSITORY_SNAPSHOT_TERMINAL_CONFLICT":
    case "REPOSITORY_SNAPSHOT_PUBLICATION_REQUIRED":
    case "WORKER_LEASE_INVALID":
    case "WORKER_JOB_STATE_CONFLICT":
      return 409;
    default:
      return 500;
  }
}

function statusForRepositoryScanError(code: RepositoryScanError["code"]): number {
  switch (code) {
    case "WORKER_DISABLED":
      return 403;
    case "REPOSITORY_SCAN_OUTPUT_INVALID":
      return 400;
    case "WORKER_LEASE_INVALID":
    case "WORKER_JOB_STATE_CONFLICT":
    case "REPOSITORY_SCAN_ARTIFACT_NOT_AVAILABLE":
    case "REPOSITORY_SCAN_ARTIFACT_AUTHORIZATION_FAILED":
    case "REPOSITORY_SCAN_PUBLICATION_REQUIRED":
    case "REPOSITORY_SCAN_TERMINAL_CONFLICT":
    case "REPOSITORY_SCAN_FINDING_ID_CONFLICT":
    case "REPOSITORY_SCAN_EVIDENCE_ID_CONFLICT":
      return 409;
    default:
      return 500;
  }
}

function writeWorkerEvent(input: {
  event: "worker.authentication_rejected" | "worker.access_rejected" | "worker.rate_limited" | "worker.request_failed";
  severity: "warning" | "error";
  route: WorkerSecurityRoute;
  code: string;
  status: number;
}): void {
  writeSecurityTelemetry({
    schema: "scopeforge.security.v1",
    event: input.event,
    severity: input.severity,
    route: input.route,
    code: input.code,
    status: input.status,
  });
}

function emitControlSecurityTelemetry(code: WorkerControlError["code"], route: WorkerSecurityRoute, status: number): void {
  switch (code) {
    case "WORKER_DISABLED":
    case "WORKER_NOT_AVAILABLE":
    case "RUNTIME_WORKER_ACCESS_DENIED":
      writeWorkerEvent({ event: "worker.access_rejected", severity: "warning", route, code, status });
      return;
    case "RUNTIME_WORKER_ACTIVE_LIMIT":
      writeWorkerEvent({ event: "worker.rate_limited", severity: "warning", route, code, status });
      return;
    default:
      return;
  }
}

export function workerJson(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function workerRouteError(error: unknown, route: WorkerSecurityRoute): Response {
  if (error instanceof WorkerBrokerAuthError) {
    writeWorkerEvent({
      event: "worker.authentication_rejected",
      severity: "warning",
      route,
      code: error.code,
      status: 401,
    });
    return workerJson({ error: { code: error.code } }, 401);
  }
  if (error instanceof WorkerTransportError) {
    return workerJson({ error: { code: error.code } }, error.status);
  }
  if (error instanceof WorkerControlError) {
    const status = statusForControlError(error.code);
    emitControlSecurityTelemetry(error.code, route, status);
    return workerJson({ error: { code: error.code } }, status);
  }
  if (error instanceof RepositorySnapshotError) {
    return workerJson({ error: { code: error.code } }, statusForRepositorySnapshotError(error.code));
  }
  if (error instanceof RepositoryScanError) {
    return workerJson({ error: { code: error.code } }, statusForRepositoryScanError(error.code));
  }
  writeWorkerEvent({
    event: "worker.request_failed",
    severity: "error",
    route,
    code: "WORKER_REQUEST_FAILED",
    status: 500,
  });
  return workerJson({ error: { code: "WORKER_REQUEST_FAILED" } }, 500);
}
