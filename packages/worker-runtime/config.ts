import path from "node:path";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SECRET = /^[a-f0-9]{64}$/;
const IMAGE = /^[a-z0-9][a-z0-9._:/-]*@sha256:[a-f0-9]{64}$/;
const HOST = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?[.][a-f0-9]{32}[.]r2[.]cloudflarestorage[.]com$/;

interface BaseConfig {
  baseUrl: string;
  workerId: string;
  secret: string;
  pollMs: number;
}
export type WorkerRuntimeConfig = (BaseConfig & {
  executionClass: "repository_snapshot_github_private_v1";
}) | (BaseConfig & {
  executionClass: "phase3_repository_scan_no_egress_v1";
  workRoot: string;
  expectedR2Host: string;
  podmanBinary: string;
  scannerImage: string;
}) | (BaseConfig & {
  executionClass: "phase11_http_discovery_v1";
  podmanBinary: string;
  runtimeImage: string;
});

function required(env: Readonly<Record<string, string | undefined>>, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Worker runtime configuration ${key} is required.`);
  return value;
}

function origin(value: string): string {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error("Worker runtime base URL is invalid."); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port
      || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("Worker runtime base URL must be an exact HTTPS origin.");
  }
  return parsed.origin;
}

function absolute(value: string, label: string): string {
  if (!path.posix.isAbsolute(value) || /[,\r\n\u0000]/.test(value)) throw new Error(`${label} must be an absolute safe path.`);
  return path.posix.normalize(value);
}

export function readWorkerRuntimeConfig(env: Readonly<Record<string, string | undefined>>): WorkerRuntimeConfig {
  const baseUrl = origin(required(env, "SCOPEFORGE_WORKER_BASE_URL"));
  const workerId = required(env, "SCOPEFORGE_WORKER_ID");
  const secret = required(env, "SCOPEFORGE_WORKER_SECRET");
  if (!UUID.test(workerId)) throw new Error("Worker runtime identity is invalid.");
  if (!SECRET.test(secret)) throw new Error("Worker runtime credential is invalid.");
  const pollText = env.SCOPEFORGE_WORKER_POLL_MS?.trim() || "2000";
  if (!/^\d+$/.test(pollText)) throw new Error("Worker runtime poll interval is invalid.");
  const pollMs = Number(pollText);
  if (!Number.isSafeInteger(pollMs) || pollMs < 250 || pollMs > 60_000) {
    throw new Error("Worker runtime poll interval is invalid.");
  }
  const executionClass = required(env, "SCOPEFORGE_WORKER_EXECUTION_CLASS");
  if (executionClass === "repository_snapshot_github_private_v1") {
    return Object.freeze({ baseUrl, workerId, secret, executionClass, pollMs });
  }
  if (executionClass === "phase11_http_discovery_v1") {
    const podmanBinary = absolute(required(env, "SCOPEFORGE_PODMAN_BINARY"), "Worker Podman binary");
    if (path.posix.basename(podmanBinary) !== "podman") throw new Error("Worker Podman binary is invalid.");
    const runtimeImage = required(env, "SCOPEFORGE_RUNTIME_IMAGE");
    if (!IMAGE.test(runtimeImage)) throw new Error("Worker runtime image must be an immutable digest reference.");
    return Object.freeze({ baseUrl, workerId, secret, executionClass, pollMs, podmanBinary, runtimeImage });
  }
  if (executionClass !== "phase3_repository_scan_no_egress_v1") {
    throw new Error("Worker runtime execution class is unsupported.");
  }
  const workRoot = absolute(required(env, "SCOPEFORGE_REPOSITORY_SCAN_WORK_ROOT"), "Worker scan root");
  const expectedR2Host = required(env, "SCOPEFORGE_R2_DOWNLOAD_HOST").toLowerCase();
  if (!HOST.test(expectedR2Host)) throw new Error("Worker runtime R2 host is invalid.");
  const podmanBinary = absolute(required(env, "SCOPEFORGE_PODMAN_BINARY"), "Worker Podman binary");
  if (path.posix.basename(podmanBinary) !== "podman") throw new Error("Worker Podman binary is invalid.");
  const scannerImage = required(env, "SCOPEFORGE_SCANNER_IMAGE");
  if (!IMAGE.test(scannerImage)) throw new Error("Worker scanner image must be an immutable digest reference.");
  return Object.freeze({
    baseUrl, workerId, secret, executionClass, pollMs,
    workRoot, expectedR2Host, podmanBinary, scannerImage,
  });
}
