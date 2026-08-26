import path from "node:path";
import type {
  PodmanCreateCommand,
  PodmanSandboxCommandInput,
} from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const IMAGE_DIGEST_PATTERN = /^[a-z0-9][a-z0-9._:/-]*@sha256:[a-f0-9]{64}$/;
const UNSAFE_MOUNT_CHARACTERS = /[,\r\n\u0000]/;

function safeUuid(value: string, label: string): string {
  if (!UUID_PATTERN.test(value)) throw new Error(`${label} must be a canonical UUID.`);
  return value;
}

function safeAbsolutePath(value: string, label: string): string {
  if (!path.isAbsolute(value) || UNSAFE_MOUNT_CHARACTERS.test(value)) {
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
    throw new Error("Hosted scanner image must be a lowercase immutable OCI image digest reference.");
  }
  return value;
}

export function buildPodmanCreateCommand(input: PodmanSandboxCommandInput): PodmanCreateCommand {
  const taskId = safeUuid(input.taskId, "Task identifier");
  const attemptId = safeUuid(input.attemptId, "Attempt identifier");
  const sourceDirectory = safeAbsolutePath(input.sourceDirectory, "Source directory");
  const taskMetadataPath = safeAbsolutePath(input.taskMetadataPath, "Task metadata path");
  const file = safePodmanBinary(input.podmanBinary);
  const image = safeImage(input.image);
  const containerName = `scopeforge-scan-${taskId}-${attemptId}`;

  return Object.freeze({
    file,
    containerName,
    args: [
      "create",
      "--name", containerName,
      "--pull=never",
      "--network=none",
      "--read-only",
      "--read-only-tmpfs=false",
      "--cap-drop=all",
      "--security-opt=no-new-privileges",
      "--pids-limit=64",
      "--memory=1g",
      "--cgroup-conf=memory.swap.max=0",
      "--cpus=1",
      "--log-driver=none",
      "--user=65532:65532",
      "--unsetenv-all",
      "--tmpfs=/tmp:rw,size=268435456,mode=0700,nosuid,nodev,noexec",
      `--mount=type=bind,src=${sourceDirectory},dst=/workspace,ro=true`,
      `--mount=type=bind,src=${taskMetadataPath},dst=/scopeforge/task.json,ro=true`,
      "--entrypoint=/usr/local/bin/node",
      image,
      "/app/hosted-scanner-entry.js",
    ],
  });
}