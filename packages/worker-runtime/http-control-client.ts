import type {
  AnyWorkerTaskContract,
  AnyWorkerTerminalEnvelope,
  PrivateRepositorySnapshotExecutionClass,
  WorkerExecutionClass,
  WorkerTerminalEnvelope,
} from "@/packages/worker-contracts";
import type { WorkerSupervisorControlClient } from "@/packages/worker-supervisor";
import type { RepositoryScanStagingArtifact } from "@/packages/worker-supervisor/repository-scan-stager";
import { validateWorkerTaskContract } from "./task-contract";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SECRET = /^[a-f0-9]{64}$/;
const ERROR_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;

export class WorkerHttpControlError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number) {
    super(code);
    this.name = "WorkerHttpControlError";
    this.code = code;
    this.status = status;
  }
}

function closedOrigin(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Worker control origin is invalid."); }
  if (url.protocol !== "https:") throw new Error("Worker control origin must use HTTPS.");
  if (url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Worker control origin must be an exact HTTPS origin.");
  }
  return url;
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Worker control response is invalid.");
  }
  return value as Record<string, unknown>;
}

function exact(value: Record<string, unknown>, keys: readonly string[]): void {
  const allowed = new Set(keys);
  if (Object.keys(value).length !== keys.length || Object.keys(value).some((key) => !allowed.has(key))) {
    throw new Error("Worker control response is invalid.");
  }
}

async function readBounded(response: Response): Promise<unknown> {
  if (response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    throw new Error("Worker control response is invalid.");
  }
  const declared = response.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_RESPONSE_BYTES)) {
    throw new Error("Worker control response exceeds the safety bound.");
  }
  if (!response.body) throw new Error("Worker control response is invalid.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Worker control response exceeds the safety bound.");
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  text += decoder.decode();
  try { return JSON.parse(text) as unknown; } catch { throw new Error("Worker control response is invalid."); }
}

function result(value: unknown): { outcome: "succeeded" | "failed" | "cancelled"; replayed: boolean } {
  const candidate = object(value);
  exact(candidate, ["outcome", "replayed"]);
  if (!new Set(["succeeded", "failed", "cancelled"]).has(String(candidate.outcome))
      || typeof candidate.replayed !== "boolean") {
    throw new Error("Worker control response is invalid.");
  }
  return Object.freeze({
    outcome: candidate.outcome as "succeeded" | "failed" | "cancelled",
    replayed: candidate.replayed,
  });
}

function heartbeat(value: unknown): { cancelRequested: boolean; leaseExpiresAt: string } {
  const candidate = object(value);
  exact(candidate, ["cancelRequested", "leaseExpiresAt"]);
  if (typeof candidate.cancelRequested !== "boolean" || typeof candidate.leaseExpiresAt !== "string"
      || !Number.isFinite(Date.parse(candidate.leaseExpiresAt))) {
    throw new Error("Worker control response is invalid.");
  }
  return Object.freeze({ cancelRequested: candidate.cancelRequested, leaseExpiresAt: candidate.leaseExpiresAt });
}

function artifact(value: unknown): RepositoryScanStagingArtifact {
  const candidate = object(value);
  exact(candidate, ["snapshotId", "storedArtifactBytes", "artifactDigest", "download"]);
  const download = object(candidate.download);
  exact(download, ["method", "url", "expiresAt"]);
  if (typeof candidate.snapshotId !== "string" || !UUID.test(candidate.snapshotId)
      || !Number.isSafeInteger(candidate.storedArtifactBytes) || (candidate.storedArtifactBytes as number) < 1
      || typeof candidate.artifactDigest !== "string" || !SECRET.test(candidate.artifactDigest)
      || download.method !== "GET" || typeof download.url !== "string" || typeof download.expiresAt !== "string") {
    throw new Error("Worker control response is invalid.");
  }
  return Object.freeze({
    snapshotId: candidate.snapshotId,
    storedArtifactBytes: candidate.storedArtifactBytes as number,
    artifactDigest: candidate.artifactDigest,
    download: Object.freeze({ method: "GET" as const, url: download.url, expiresAt: download.expiresAt }),
  });
}

export function createWorkerHttpControlClient(input: {
  baseUrl: string;
  workerId: string;
  secret: string;
  expectedExecutionClass?: WorkerExecutionClass | PrivateRepositorySnapshotExecutionClass;
  fetch?: typeof fetch;
}): WorkerSupervisorControlClient {
  const origin = closedOrigin(input.baseUrl);
  if (!UUID.test(input.workerId)) throw new Error("Worker identity is invalid.");
  if (!SECRET.test(input.secret)) throw new Error("Worker credential is invalid.");
  const requestFetch = input.fetch ?? fetch;

  const call = async (path: string, body?: unknown): Promise<unknown> => {
    const response = await requestFetch(new URL(path, origin), {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.secret}`,
        "x-scopeforge-worker-id": input.workerId,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const payload = object(await readBounded(response));
    if (!response.ok) {
      exact(payload, ["error"]);
      const error = object(payload.error);
      exact(error, ["code"]);
      const code = typeof error.code === "string" && ERROR_CODE.test(error.code)
        ? error.code
        : "WORKER_CONTROL_FAILED";
      throw new WorkerHttpControlError(code, response.status);
    }
    exact(payload, ["ok", "data"]);
    if (payload.ok !== true) throw new Error("Worker control response is invalid.");
    return payload.data;
  };

  return Object.freeze({
    async claim(): Promise<AnyWorkerTaskContract | null> {
      const data = await call("/api/internal/workers/claim");
      return data === null ? null : validateWorkerTaskContract(data, input.expectedExecutionClass);
    },
    async heartbeat(body: Parameters<WorkerSupervisorControlClient["heartbeat"]>[0]) {
      return heartbeat(await call("/api/internal/workers/heartbeat", body));
    },
    async finalize(body: Parameters<WorkerSupervisorControlClient["finalize"]>[0]) {
      return result(await call("/api/internal/workers/finalize", body));
    },
    async repositoryScanArtifact(body: Parameters<NonNullable<WorkerSupervisorControlClient["repositoryScanArtifact"]>>[0]) {
      return artifact(await call("/api/internal/workers/repository-scans/artifact", body));
    },
    async repositoryScanFinalizeSuccess(body: {
      taskId: string; attemptId: string; leaseToken: string; terminal: WorkerTerminalEnvelope;
    }) {
      const value = result(await call("/api/internal/workers/repository-scans/finalize", body));
      if (value.outcome !== "succeeded") throw new Error("Worker control response is invalid.");
      return value as { outcome: "succeeded"; replayed: boolean };
    },
  });
}
