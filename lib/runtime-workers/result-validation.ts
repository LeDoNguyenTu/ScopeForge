import {
  validateWorkerTerminalEnvelope,
  type WorkerTerminalEnvelope,
} from "@/packages/worker-contracts";
import type { RuntimeWorkerExecutionClass } from "./types";

export interface RuntimeWorkerTerminalExpectation {
  taskId: string;
  attemptId: string;
  executionClass: RuntimeWorkerExecutionClass;
}

const SELECTED_PASSIVE_HEADERS = new Set([
  "content-type",
  "strict-transport-security",
  "content-security-policy",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "server",
]);

const REDIRECT_REASONS = new Set([
  "SCHEME",
  "PORT",
  "CREDENTIALS",
  "CROSS_HOST",
  "REDIRECT_LIMIT",
  "REQUEST_LIMIT",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  context: string,
): void {
  const allowed = new Set([...required, ...optional]);
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (unexpected.length > 0) {
    throw new Error(`${context} contains unexpected fields: ${unexpected.join(", ")}.`);
  }
  for (const key of required) {
    if (!(key in value)) throw new Error(`${context} is missing ${key}.`);
  }
}

function assertString(value: unknown, maximum: number, label: string): asserts value is string {
  if (typeof value !== "string" || value.length > maximum) {
    throw new Error(`${label} is invalid.`);
  }
}

function assertStringOrNull(value: unknown, maximum: number, label: string): void {
  if (value === null) return;
  assertString(value, maximum, label);
}

function assertHttpStatus(value: unknown, label: string): void {
  if (!Number.isInteger(value) || (value as number) < 100 || (value as number) > 599) {
    throw new Error(`${label} is invalid.`);
  }
}

function assertRedactedHttpsUrl(value: unknown, label: string): void {
  if (typeof value !== "string") throw new Error(`${label} is invalid.`);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} is invalid.`);
  }
  if (
    parsed.protocol !== "https:"
    || parsed.hostname.length === 0
    || parsed.username.length > 0
    || parsed.password.length > 0
    || parsed.search.length > 0
    || parsed.hash.length > 0
    || (parsed.port.length > 0 && parsed.port !== "443")
  ) {
    throw new Error(`${label} is not a redacted HTTPS URL.`);
  }
}

function validatePassiveObservation(value: unknown): void {
  if (!isRecord(value) || typeof value.kind !== "string") {
    throw new Error("Passive runtime observation is invalid.");
  }

  switch (value.kind) {
    case "http-status":
      assertKeys(value, ["kind", "url", "status"], [], "Passive HTTP status observation");
      assertRedactedHttpsUrl(value.url, "Passive HTTP status URL");
      assertHttpStatus(value.status, "Passive HTTP status");
      return;

    case "redirect": {
      assertKeys(
        value,
        ["kind", "from", "toHost", "followed"],
        ["reason"],
        "Passive redirect observation",
      );
      assertRedactedHttpsUrl(value.from, "Passive redirect source URL");
      assertString(value.toHost, 253, "Passive redirect host");
      if (typeof value.followed !== "boolean") {
        throw new Error("Passive redirect followed flag is invalid.");
      }
      if (value.followed) {
        if (value.reason !== undefined) {
          throw new Error("Followed passive redirects cannot carry a rejection reason.");
        }
      } else if (typeof value.reason !== "string" || !REDIRECT_REASONS.has(value.reason)) {
        throw new Error("Rejected passive redirect reason is invalid.");
      }
      return;
    }

    case "header":
      assertKeys(value, ["kind", "name", "present"], ["value"], "Passive header observation");
      if (typeof value.name !== "string" || !SELECTED_PASSIVE_HEADERS.has(value.name)) {
        throw new Error("Passive header observation name is invalid.");
      }
      if (typeof value.present !== "boolean") {
        throw new Error("Passive header presence flag is invalid.");
      }
      if (value.present) {
        assertString(value.value, 1_024, "Passive header value");
      } else if (value.value !== undefined) {
        throw new Error("Absent passive headers cannot carry a value.");
      }
      return;

    case "cookie":
      assertKeys(
        value,
        ["kind", "name", "secure", "httpOnly", "sameSite"],
        [],
        "Passive cookie observation",
      );
      assertString(value.name, 128, "Passive cookie name");
      if (typeof value.secure !== "boolean" || typeof value.httpOnly !== "boolean") {
        throw new Error("Passive cookie flags are invalid.");
      }
      assertStringOrNull(value.sameSite, 32, "Passive cookie SameSite attribute");
      return;

    case "tls":
      assertKeys(
        value,
        ["kind", "protocol", "validFrom", "validTo", "sanCount", "hostnameMatches"],
        [],
        "Passive TLS observation",
      );
      assertStringOrNull(value.protocol, 128, "Passive TLS protocol");
      assertStringOrNull(value.validFrom, 256, "Passive TLS valid-from value");
      assertStringOrNull(value.validTo, 256, "Passive TLS valid-to value");
      if (!Number.isInteger(value.sanCount) || (value.sanCount as number) < 0) {
        throw new Error("Passive TLS SAN count is invalid.");
      }
      if (value.hostnameMatches !== null && typeof value.hostnameMatches !== "boolean") {
        throw new Error("Passive TLS hostname match flag is invalid.");
      }
      return;

    default:
      throw new Error("Passive runtime observation kind is invalid.");
  }
}

function validatePassiveSuccess(terminal: WorkerTerminalEnvelope): void {
  if (terminal.result?.kind !== "passive_runtime_observation") {
    throw new Error("Passive runtime success requires normalized observations.");
  }
  for (const observation of terminal.result.observations) {
    validatePassiveObservation(observation);
  }
}

function validateActiveSuccess(terminal: WorkerTerminalEnvelope): void {
  if (
    terminal.result?.kind !== "active_cors_validation"
    || terminal.result.requestCount !== 1
    || !isRecord(terminal.result.observation)
    || terminal.result.observation.kind !== "cors-policy"
  ) {
    throw new Error("Active CORS success requires exactly one normalized CORS observation.");
  }

  const observation = terminal.result.observation as unknown as Record<string, unknown>;
  assertKeys(
    observation,
    [
      "kind",
      "url",
      "status",
      "allowedOrigin",
      "credentialsAllowed",
      "variesOnOrigin",
    ],
    [],
    "Active CORS observation",
  );
  assertRedactedHttpsUrl(observation.url, "Active CORS observation URL");
  assertHttpStatus(observation.status, "Active CORS response status");
  assertStringOrNull(observation.allowedOrigin, 2_048, "Active CORS allowed origin");
  if (
    typeof observation.credentialsAllowed !== "boolean"
    || typeof observation.variesOnOrigin !== "boolean"
  ) {
    throw new Error("Active CORS observation flags are invalid.");
  }
}

export function validateRuntimeWorkerTerminal(
  value: unknown,
  expected: RuntimeWorkerTerminalExpectation,
): WorkerTerminalEnvelope {
  const terminal = validateWorkerTerminalEnvelope(value, expected);
  if (
    terminal.executionClass !== "passive_runtime_observation_v1"
    && terminal.executionClass !== "active_cors_validation_v1"
  ) {
    throw new Error("Phase 6D terminal execution class is invalid.");
  }
  if (terminal.outcome === "succeeded") {
    if (terminal.executionClass === "passive_runtime_observation_v1") {
      validatePassiveSuccess(terminal);
    } else {
      validateActiveSuccess(terminal);
    }
  }
  return terminal;
}