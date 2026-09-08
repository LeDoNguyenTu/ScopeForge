import type { RuntimeObservation } from "@/packages/runtime-observer";
import type { CorsPolicyObservation } from "@/packages/runtime-validator";
import {
  RuntimeMediatorProtocolError,
  type RuntimeMediatorExecutionClass,
  type RuntimeMediatorResult,
  type RuntimeMediatorRunRequest,
  type RuntimeMediatorSessionIdentity,
} from "./contracts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NONCE_PATTERN = /^[a-f0-9]{64}$/;
const PASSIVE_RESULT_MAX_BYTES = 131_072;
const ACTIVE_RESULT_MAX_BYTES = 65_536;
const SELECTED_HEADERS = new Set([
  "content-type",
  "strict-transport-security",
  "content-security-policy",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "server",
]);

function invalidRequest(): never {
  throw new RuntimeMediatorProtocolError("MEDIATOR_REQUEST_INVALID");
}

function invalidResult(): never {
  throw new RuntimeMediatorProtocolError("MEDIATOR_RESULT_INVALID");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && keys.every((key) => allowed.has(key));
}

function finiteInteger(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
}

function boundedString(value: unknown, maximum: number, allowEmpty = false): value is string {
  return typeof value === "string"
    && value.length <= maximum
    && (allowEmpty || value.length > 0);
}

function safeHttpsUrl(value: unknown): value is string {
  if (!boundedString(value, 2_048)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.username === ""
      && url.password === ""
      && url.search === ""
      && url.hash === "";
  } catch {
    return false;
  }
}

function validHost(value: unknown): value is string {
  if (!boundedString(value, 253)) return false;
  if (/[/\\?#@\s]/.test(value)) return false;
  try {
    const url = new URL(`https://${value}`);
    return url.hostname.toLowerCase() === value.toLowerCase();
  } catch {
    return false;
  }
}

export function validateRuntimeMediatorSessionIdentity(
  value: unknown,
): RuntimeMediatorSessionIdentity {
  if (!isRecord(value)
      || !exactKeys(value, ["taskId", "attemptId", "executionClass", "nonce"])
      || typeof value.taskId !== "string"
      || !UUID_PATTERN.test(value.taskId)
      || typeof value.attemptId !== "string"
      || !UUID_PATTERN.test(value.attemptId)
      || (value.executionClass !== "passive_runtime_observation_v1"
        && value.executionClass !== "active_cors_validation_v1")
      || typeof value.nonce !== "string"
      || !NONCE_PATTERN.test(value.nonce)) {
    invalidRequest();
  }

  return Object.freeze({
    taskId: value.taskId,
    attemptId: value.attemptId,
    executionClass: value.executionClass,
    nonce: value.nonce,
  });
}

export function validateRuntimeMediatorRunRequest(value: unknown): RuntimeMediatorRunRequest {
  if (!isRecord(value)
      || !exactKeys(value, ["operation", "session"])
      || value.operation !== "run") {
    invalidRequest();
  }

  return Object.freeze({
    operation: "run" as const,
    session: validateRuntimeMediatorSessionIdentity(value.session),
  });
}

function validateHttpStatus(value: Record<string, unknown>): RuntimeObservation {
  if (!exactKeys(value, ["kind", "url", "status"])
      || !safeHttpsUrl(value.url)
      || !finiteInteger(value.status, 100, 599)) {
    invalidResult();
  }
  return Object.freeze({ kind: "http-status" as const, url: value.url, status: value.status });
}

function validateRedirect(value: Record<string, unknown>): RuntimeObservation {
  if (!exactKeys(value, ["kind", "from", "toHost", "followed"], ["reason"])
      || !safeHttpsUrl(value.from)
      || !validHost(value.toHost)
      || typeof value.followed !== "boolean"
      || (value.reason !== undefined && !boundedString(value.reason, 256))) {
    invalidResult();
  }
  return Object.freeze({
    kind: "redirect" as const,
    from: value.from,
    toHost: value.toHost,
    followed: value.followed,
    ...(value.reason === undefined ? {} : { reason: value.reason }),
  });
}

function validateHeader(value: Record<string, unknown>): RuntimeObservation {
  if (!exactKeys(value, ["kind", "name", "present"], ["value"])
      || typeof value.name !== "string"
      || !SELECTED_HEADERS.has(value.name)
      || typeof value.present !== "boolean") {
    invalidResult();
  }
  if (value.present) {
    if (!boundedString(value.value, 1_024, true)) invalidResult();
    return Object.freeze({
      kind: "header" as const,
      name: value.name,
      present: true,
      value: value.value,
    });
  }
  if (value.value !== undefined) invalidResult();
  return Object.freeze({ kind: "header" as const, name: value.name, present: false });
}

function validateCookie(value: Record<string, unknown>): RuntimeObservation {
  if (!exactKeys(value, ["kind", "name", "secure", "httpOnly", "sameSite"])
      || !boundedString(value.name, 128, true)
      || typeof value.secure !== "boolean"
      || typeof value.httpOnly !== "boolean"
      || (value.sameSite !== null && !boundedString(value.sameSite, 32, true))) {
    invalidResult();
  }
  return Object.freeze({
    kind: "cookie" as const,
    name: value.name,
    secure: value.secure,
    httpOnly: value.httpOnly,
    sameSite: value.sameSite,
  });
}

function nullableBoundedString(value: unknown, maximum: number): value is string | null {
  return value === null || boundedString(value, maximum, true);
}

function validateTls(value: Record<string, unknown>): RuntimeObservation {
  if (!exactKeys(value, ["kind", "protocol", "validFrom", "validTo", "sanCount", "hostnameMatches"])
      || !nullableBoundedString(value.protocol, 64)
      || !nullableBoundedString(value.validFrom, 128)
      || !nullableBoundedString(value.validTo, 128)
      || !finiteInteger(value.sanCount, 0, 10_000)
      || (value.hostnameMatches !== null && typeof value.hostnameMatches !== "boolean")) {
    invalidResult();
  }
  return Object.freeze({
    kind: "tls" as const,
    protocol: value.protocol,
    validFrom: value.validFrom,
    validTo: value.validTo,
    sanCount: value.sanCount,
    hostnameMatches: value.hostnameMatches,
  });
}

function validatePassiveObservation(value: unknown): RuntimeObservation {
  if (!isRecord(value) || typeof value.kind !== "string") invalidResult();
  switch (value.kind) {
    case "http-status":
      return validateHttpStatus(value);
    case "redirect":
      return validateRedirect(value);
    case "header":
      return validateHeader(value);
    case "cookie":
      return validateCookie(value);
    case "tls":
      return validateTls(value);
    default:
      return invalidResult();
  }
}

function validateCorsObservation(value: unknown): CorsPolicyObservation {
  if (!isRecord(value)
      || !exactKeys(value, [
        "kind",
        "url",
        "status",
        "allowedOrigin",
        "credentialsAllowed",
        "variesOnOrigin",
      ])
      || value.kind !== "cors-policy"
      || !safeHttpsUrl(value.url)
      || !finiteInteger(value.status, 100, 599)
      || (value.allowedOrigin !== null && !boundedString(value.allowedOrigin, 2_048, true))
      || typeof value.credentialsAllowed !== "boolean"
      || typeof value.variesOnOrigin !== "boolean") {
    invalidResult();
  }
  return Object.freeze({
    kind: "cors-policy" as const,
    url: value.url,
    status: value.status,
    allowedOrigin: value.allowedOrigin,
    credentialsAllowed: value.credentialsAllowed,
    variesOnOrigin: value.variesOnOrigin,
  });
}

function ensureResultSize(value: unknown, maximum: number): void {
  let bytes: number;
  try {
    bytes = Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    invalidResult();
  }
  if (bytes > maximum) {
    throw new RuntimeMediatorProtocolError("MEDIATOR_RESULT_TOO_LARGE");
  }
}

export function validateRuntimeMediatorResult(
  value: unknown,
  executionClass: RuntimeMediatorExecutionClass,
): RuntimeMediatorResult {
  if (!isRecord(value)) invalidResult();

  if (executionClass === "passive_runtime_observation_v1") {
    ensureResultSize(value, PASSIVE_RESULT_MAX_BYTES);
    if (!exactKeys(value, ["kind", "requestCount", "redirectCount", "observations"])
        || value.kind !== "passive_runtime_observation"
        || !finiteInteger(value.requestCount, 0, 4)
        || !finiteInteger(value.redirectCount, 0, 3)
        || !Array.isArray(value.observations)
        || value.observations.length > 256) {
      invalidResult();
    }
    return Object.freeze({
      kind: "passive_runtime_observation" as const,
      requestCount: value.requestCount,
      redirectCount: value.redirectCount,
      observations: Object.freeze(value.observations.map(validatePassiveObservation)),
    });
  }

  ensureResultSize(value, ACTIVE_RESULT_MAX_BYTES);
  if (!exactKeys(value, ["kind", "requestCount", "observation"])
      || value.kind !== "active_cors_validation"
      || value.requestCount !== 1) {
    invalidResult();
  }
  return Object.freeze({
    kind: "active_cors_validation" as const,
    requestCount: 1 as const,
    observation: validateCorsObservation(value.observation),
  });
}
