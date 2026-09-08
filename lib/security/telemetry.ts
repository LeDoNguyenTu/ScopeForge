export type WorkerSecurityRoute =
  | "worker.claim"
  | "worker.heartbeat"
  | "worker.finalize"
  | "worker.repository_scan_artifact"
  | "worker.repository_scan_finalize"
  | "worker.runtime_prepare"
  | "worker.runtime_finalize";

type WorkerSecurityEvent = {
  schema: "scopeforge.security.v1";
  event:
    | "worker.authentication_rejected"
    | "worker.access_rejected"
    | "worker.rate_limited"
    | "worker.request_failed";
  severity: "warning" | "error";
  route: WorkerSecurityRoute;
  code: string;
  status: number;
};

type ControlMisconfigurationEvent = {
  schema: "scopeforge.security.v1";
  event: "security.control_misconfigured";
  severity: "error";
  route: "security.config";
  control: string;
};

export type SecurityTelemetryEvent = WorkerSecurityEvent | ControlMisconfigurationEvent;

const WORKER_ROUTES = new Set<WorkerSecurityRoute>([
  "worker.claim",
  "worker.heartbeat",
  "worker.finalize",
  "worker.repository_scan_artifact",
  "worker.repository_scan_finalize",
  "worker.runtime_prepare",
  "worker.runtime_finalize",
]);

const WARNING_EVENTS = new Set([
  "worker.authentication_rejected",
  "worker.access_rejected",
  "worker.rate_limited",
]);

const CODE_PATTERN = /^[A-Z0-9_]{1,80}$/;
const CONTROL_PATTERN = /^[a-z0-9_.-]{1,64}$/;
const MAX_SERIALIZED_BYTES = 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeEvent(event: SecurityTelemetryEvent): SecurityTelemetryEvent | null {
  if (!isRecord(event) || event.schema !== "scopeforge.security.v1") return null;

  if (event.event === "security.control_misconfigured") {
    if (
      event.severity !== "error"
      || event.route !== "security.config"
      || typeof event.control !== "string"
      || !CONTROL_PATTERN.test(event.control)
    ) {
      return null;
    }
    return {
      schema: "scopeforge.security.v1",
      event: "security.control_misconfigured",
      severity: "error",
      route: "security.config",
      control: event.control,
    };
  }

  if (
    event.event !== "worker.authentication_rejected"
    && event.event !== "worker.access_rejected"
    && event.event !== "worker.rate_limited"
    && event.event !== "worker.request_failed"
  ) {
    return null;
  }

  const expectedSeverity = event.event === "worker.request_failed" ? "error" : "warning";
  if (
    event.severity !== expectedSeverity
    || !WORKER_ROUTES.has(event.route)
    || typeof event.code !== "string"
    || !CODE_PATTERN.test(event.code)
    || !Number.isInteger(event.status)
    || event.status < 400
    || event.status > 599
  ) {
    return null;
  }

  return {
    schema: "scopeforge.security.v1",
    event: event.event,
    severity: expectedSeverity,
    route: event.route,
    code: event.code,
    status: event.status,
  };
}

export function writeSecurityTelemetry(event: SecurityTelemetryEvent): void {
  try {
    const normalized = normalizeEvent(event);
    if (!normalized) return;

    const serialized = JSON.stringify(normalized);
    if (Buffer.byteLength(serialized, "utf8") > MAX_SERIALIZED_BYTES) return;

    if (normalized.severity === "error") {
      console.error(serialized);
      return;
    }
    if (WARNING_EVENTS.has(normalized.event)) console.warn(serialized);
  } catch {
    // Observability must never change the protected request path or serialize rejected input.
  }
}
