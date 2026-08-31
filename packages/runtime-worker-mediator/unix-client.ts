import { createConnection } from "node:net";
import {
  RuntimeMediatorProtocolError,
  type RuntimeMediatorExecutionClass,
  type RuntimeMediatorRunRequest,
} from "./contracts";
import {
  validateRuntimeMediatorResult,
  validateRuntimeMediatorRunRequest,
} from "./validation";

export const RUNTIME_MEDIATOR_CONTAINER_SOCKET_PATH = "/run/scopeforge/mediator.sock" as const;
export const RUNTIME_MEDIATOR_REQUEST_MAX_BYTES = 4_096;
export const RUNTIME_MEDIATOR_RESPONSE_MAX_BYTES = 196_608;

function wireInvalid(): never {
  throw new RuntimeMediatorProtocolError("MEDIATOR_REQUEST_INVALID");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, required: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === required.length && required.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function count(value: unknown, maximum: number): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= maximum;
}

const PASSIVE_FAILURES = new Set([
  "PASSIVE_RUNTIME_REQUEST_TIMEOUT",
  "PASSIVE_RUNTIME_TOTAL_TIMEOUT",
  "PASSIVE_RUNTIME_NETWORK_ERROR",
  "PASSIVE_RUNTIME_OBSERVATION_BUDGET",
]);
const ACTIVE_FAILURES = new Set([
  "ACTIVE_CORS_REQUEST_TIMEOUT",
  "ACTIVE_CORS_TOTAL_TIMEOUT",
  "ACTIVE_CORS_NETWORK_ERROR",
  "ACTIVE_CORS_OBSERVATION_BUDGET",
]);

export function validateRuntimeMediatorWireResponse(
  value: unknown,
  executionClass: RuntimeMediatorExecutionClass,
): unknown {
  if (!isRecord(value) || typeof value.status !== "string") wireInvalid();

  if (value.status === "succeeded") {
    if (!exactKeys(value, ["status", "result"])) wireInvalid();
    return Object.freeze({
      status: "succeeded" as const,
      result: validateRuntimeMediatorResult(value.result, executionClass),
    });
  }

  if (executionClass === "passive_runtime_observation_v1") {
    if (value.status === "cancelled") {
      if (!exactKeys(value, ["status", "requestCount", "redirectCount"])
          || !count(value.requestCount, 4)
          || !count(value.redirectCount, 3)) wireInvalid();
      return Object.freeze({
        status: "cancelled" as const,
        requestCount: value.requestCount,
        redirectCount: value.redirectCount,
      });
    }
    if (value.status === "failed") {
      if (!exactKeys(value, ["status", "failureCode", "requestCount", "redirectCount"])
          || typeof value.failureCode !== "string"
          || !PASSIVE_FAILURES.has(value.failureCode)
          || !count(value.requestCount, 4)
          || !count(value.redirectCount, 3)) wireInvalid();
      return Object.freeze({
        status: "failed" as const,
        failureCode: value.failureCode,
        requestCount: value.requestCount,
        redirectCount: value.redirectCount,
      });
    }
    wireInvalid();
  }

  if (value.status === "cancelled") {
    if (!exactKeys(value, ["status", "requestCount"])
        || !count(value.requestCount, 1)) wireInvalid();
    return Object.freeze({ status: "cancelled" as const, requestCount: value.requestCount });
  }
  if (value.status === "failed") {
    if (!exactKeys(value, ["status", "failureCode", "requestCount"])
        || typeof value.failureCode !== "string"
        || !ACTIVE_FAILURES.has(value.failureCode)
        || !count(value.requestCount, 1)) wireInvalid();
    return Object.freeze({
      status: "failed" as const,
      failureCode: value.failureCode,
      requestCount: value.requestCount,
    });
  }
  return wireInvalid();
}

export function encodeRuntimeMediatorFrame(value: unknown, maximumBytes: number): Buffer {
  if (!Number.isInteger(maximumBytes) || maximumBytes <= 0) wireInvalid();
  let payload: Buffer;
  try {
    payload = Buffer.from(JSON.stringify(value), "utf8");
  } catch {
    return wireInvalid();
  }
  if (payload.length === 0 || payload.length > maximumBytes) wireInvalid();
  const frame = Buffer.allocUnsafe(4 + payload.length);
  frame.writeUInt32BE(payload.length, 0);
  payload.copy(frame, 4);
  return frame;
}

export function createRuntimeMediatorFrameDecoder(
  maximumBytes: number,
  mode: "json" | "request" = "json",
) {
  if (!Number.isInteger(maximumBytes) || maximumBytes <= 0) wireInvalid();
  const header = Buffer.allocUnsafe(4);
  let headerBytes = 0;
  let expectedPayloadBytes: number | null = null;
  let payload: Buffer | null = null;
  let payloadBytes = 0;

  function reset(): void {
    headerBytes = 0;
    expectedPayloadBytes = null;
    payload = null;
    payloadBytes = 0;
  }

  function hasPendingData(): boolean {
    return headerBytes !== 0
      || expectedPayloadBytes !== null
      || payload !== null
      || payloadBytes !== 0;
  }

  function push(chunk: Buffer): unknown[] {
    if (!Buffer.isBuffer(chunk)) wireInvalid();
    const values: unknown[] = [];
    let offset = 0;

    while (offset < chunk.length) {
      if (expectedPayloadBytes === null) {
        const needed = 4 - headerBytes;
        const copied = Math.min(needed, chunk.length - offset);
        chunk.copy(header, headerBytes, offset, offset + copied);
        headerBytes += copied;
        offset += copied;
        if (headerBytes < 4) continue;

        expectedPayloadBytes = header.readUInt32BE(0);
        if (expectedPayloadBytes <= 0 || expectedPayloadBytes > maximumBytes) wireInvalid();
        payload = Buffer.allocUnsafe(expectedPayloadBytes);
        payloadBytes = 0;
      }

      const remaining = (expectedPayloadBytes as number) - payloadBytes;
      const copied = Math.min(remaining, chunk.length - offset);
      chunk.copy(payload as Buffer, payloadBytes, offset, offset + copied);
      payloadBytes += copied;
      offset += copied;
      if (payloadBytes < (expectedPayloadBytes as number)) continue;

      let decoded: unknown;
      try {
        decoded = JSON.parse((payload as Buffer).toString("utf8"));
      } catch {
        return wireInvalid();
      }
      values.push(mode === "request" ? validateRuntimeMediatorRunRequest(decoded) : decoded);
      reset();
    }

    return values;
  }

  return Object.freeze({ push, hasPendingData });
}

export function runRuntimeMediatorUnixRequest(
  request: RuntimeMediatorRunRequest,
  timeoutMs: number,
): Promise<unknown> {
  const validated = validateRuntimeMediatorRunRequest(request);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30_000) wireInvalid();

  return new Promise((resolve, reject) => {
    const socket = createConnection({ path: RUNTIME_MEDIATOR_CONTAINER_SOCKET_PATH });
    const decoder = createRuntimeMediatorFrameDecoder(RUNTIME_MEDIATOR_RESPONSE_MAX_BYTES);
    let settled = false;

    function fail(error: unknown): void {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(error instanceof RuntimeMediatorProtocolError
        ? error
        : new RuntimeMediatorProtocolError("MEDIATOR_SESSION_INVALID"));
    }

    socket.setTimeout(timeoutMs, () => fail(new RuntimeMediatorProtocolError("MEDIATOR_SESSION_EXPIRED")));
    socket.once("error", fail);
    socket.on("data", (chunk) => {
      try {
        const values = decoder.push(chunk);
        if (values.length === 0) return;
        if (values.length !== 1 || decoder.hasPendingData() || settled) {
          return fail(new RuntimeMediatorProtocolError("MEDIATOR_REQUEST_INVALID"));
        }
        const response = validateRuntimeMediatorWireResponse(values[0], validated.session.executionClass);
        settled = true;
        socket.end();
        resolve(response);
      } catch (error) {
        fail(error);
      }
    });
    socket.once("connect", () => {
      try {
        socket.write(encodeRuntimeMediatorFrame(validated, RUNTIME_MEDIATOR_REQUEST_MAX_BYTES));
      } catch (error) {
        fail(error);
      }
    });
  });
}
