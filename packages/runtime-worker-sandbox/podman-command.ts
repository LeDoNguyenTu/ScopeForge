import path from "node:path";
import type {
  RuntimeWorkerExecutionClass,
  RuntimeWorkerPodmanCommandInput,
  RuntimeWorkerPodmanCreateCommand,
} from "./types";

export const RUNTIME_MEDIATOR_HOST_SOCKET_ROOT = "/run/scopeforge/runtime-mediator" as const;
export const RUNTIME_MEDIATOR_CONTAINER_SOCKET_PATH = "/run/scopeforge/mediator.sock" as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const IMAGE_DIGEST_PATTERN = /^[a-z0-9][a-z0-9._:/-]*@sha256:[a-f0-9]{64}$/;
const SOCKET_NAME_PATTERN = /^[a-f0-9]{64}[.]sock$/;
const UNSAFE_PATH_CHARACTERS = /[,\r\n\u0000]/;

function safeUuid(value: string, label: string): string {
  if (!UUID_PATTERN.test(value)) throw new Error(`${label} must be a canonical UUID.`);
  return value;
}

function safeExecutionClass(value: RuntimeWorkerExecutionClass): RuntimeWorkerExecutionClass {
  if (value !== "passive_runtime_observation_v1" && value !== "active_cors_validation_v1") {
    throw new Error("Runtime worker execution class is invalid.");
  }
  return value;
}

function safeNonce(value: string): string {
  if (!SHA256_PATTERN.test(value)) {
    throw new Error("Runtime mediator session nonce is invalid.");
  }
  return value;
}

function safeAbsolutePath(value: string, label: string): string {
  if (!path.isAbsolute(value) || UNSAFE_PATH_CHARACTERS.test(value)) {
    throw new Error(`${label} must be an injection-safe absolute path.`);
  }
  return path.normalize(value);
}

function safePodmanBinary(value: string): string {
  const binary = safeAbsolutePath(value, "Podman binary");
  if (path.basename(binary) !== "podman") {
    throw new Error("Podman binary path must resolve to the podman executable name.");
  }
  return binary;
}

function safeImage(value: string): string {
  if (!IMAGE_DIGEST_PATTERN.test(value) || value.includes("://")) {
    throw new Error("Runtime worker image must be a lowercase immutable OCI digest reference.");
  }
  return value;
}

export function validateRuntimeMediatorHostSocketPath(value: string): string {
  const normalized = safeAbsolutePath(value, "Mediator socket path");
  if (path.dirname(normalized) !== RUNTIME_MEDIATOR_HOST_SOCKET_ROOT
      || !SOCKET_NAME_PATTERN.test(path.basename(normalized))) {
    throw new Error("Mediator socket path is outside the fixed supervisor-owned root.");
  }
  return normalized;
}

export function buildRuntimeWorkerPodmanCreateCommand(
  input: RuntimeWorkerPodmanCommandInput,
): RuntimeWorkerPodmanCreateCommand {
  const taskId = safeUuid(input.taskId, "Task identifier");
  const attemptId = safeUuid(input.attemptId, "Attempt identifier");
  const executionClass = safeExecutionClass(input.executionClass);
  const mediatorSessionNonce = safeNonce(input.mediatorSessionNonce);
  const file = safePodmanBinary(input.podmanBinary);
  const image = safeImage(input.image);
  const mediatorSocketPath = validateRuntimeMediatorHostSocketPath(input.mediatorSocketPath);
  const containerName = `scopeforge-runtime-${taskId}-${attemptId}`;

  return Object.freeze({
    file,
    containerName,
    args: Object.freeze([
      "create",
      "--name", containerName,
      "--pull=never",
      "--network=none",
      "--read-only",
      "--read-only-tmpfs=false",
      "--cap-drop=all",
      "--security-opt=no-new-privileges",
      "--pids-limit=1",
      "--memory=256m",
      "--cgroup-conf=memory.swap.max=0",
      "--cpus=1",
      "--log-driver=none",
      "--user=65532:65532",
      "--unsetenv-all",
      "--tmpfs=/tmp:rw,size=16777216,mode=0700,nosuid,nodev,noexec",
      `--mount=type=bind,src=${mediatorSocketPath},dst=${RUNTIME_MEDIATOR_CONTAINER_SOCKET_PATH}`,
      "--entrypoint=/usr/local/bin/node",
      image,
      "/app/runtime-worker-entry.js",
      "--task-id", taskId,
      "--attempt-id", attemptId,
      "--execution-class", executionClass,
      "--session-nonce", mediatorSessionNonce,
    ]),
  });
}
