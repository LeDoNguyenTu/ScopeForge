export const WORKER_CONTROL_MAX_BODY_BYTES = 65_536;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class WorkerTransportError extends Error {
  readonly code: "WORKER_REQUEST_INVALID" | "WORKER_REQUEST_TOO_LARGE" | "WORKER_CONTENT_TYPE_UNSUPPORTED";
  readonly status: number;

  constructor(
    code: WorkerTransportError["code"],
    status: number,
  ) {
    super(code);
    this.name = "WorkerTransportError";
    this.code = code;
    this.status = status;
  }
}

function declaredLength(request: Request): number | null {
  const value = request.headers.get("content-length");
  if (value === null) return null;
  if (!/^\d+$/.test(value)) throw new WorkerTransportError("WORKER_REQUEST_INVALID", 400);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new WorkerTransportError("WORKER_REQUEST_INVALID", 400);
  return parsed;
}

export function workerUuid(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new WorkerTransportError("WORKER_REQUEST_INVALID", 400);
  }
  return value;
}

export function assertNoWorkerRequestBody(request: Request): void {
  const length = declaredLength(request);
  if ((length !== null && length !== 0) || request.body !== null) {
    throw new WorkerTransportError("WORKER_REQUEST_INVALID", 400);
  }
}

export async function readBoundedWorkerJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new WorkerTransportError("WORKER_CONTENT_TYPE_UNSUPPORTED", 415);
  }

  const length = declaredLength(request);
  if (length !== null && length > WORKER_CONTROL_MAX_BODY_BYTES) {
    throw new WorkerTransportError("WORKER_REQUEST_TOO_LARGE", 413);
  }
  if (!request.body) throw new WorkerTransportError("WORKER_REQUEST_INVALID", 400);

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > WORKER_CONTROL_MAX_BODY_BYTES) {
        await reader.cancel();
        throw new WorkerTransportError("WORKER_REQUEST_TOO_LARGE", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    if (error instanceof WorkerTransportError) throw error;
    throw new WorkerTransportError("WORKER_REQUEST_INVALID", 400);
  }

  if (text.length === 0) throw new WorkerTransportError("WORKER_REQUEST_INVALID", 400);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new WorkerTransportError("WORKER_REQUEST_INVALID", 400);
  }
}

export function strictObject(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new WorkerTransportError("WORKER_REQUEST_INVALID", 400);
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set(keys);
  if (Object.keys(record).some((key) => !allowed.has(key))) {
    throw new WorkerTransportError("WORKER_REQUEST_INVALID", 400);
  }
  if (keys.some((key) => !(key in record))) {
    throw new WorkerTransportError("WORKER_REQUEST_INVALID", 400);
  }
  return record;
}
