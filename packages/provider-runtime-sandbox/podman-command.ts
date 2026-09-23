import path from "node:path";
import {
  PROVIDER_EGRESS_CONTAINER_SOCKET_PATH,
  PROVIDER_EGRESS_HOST_SOCKET_ROOT,
} from "../provider-egress-boundary";
import type {
  ExternalProviderKind,
  ExternalProviderSandboxInput,
  ExternalProviderSandboxPlan,
} from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const IMAGE_DIGEST_PATTERN = /^[a-z0-9][a-z0-9._:/-]*@sha256:[a-f0-9]{64}$/;
const SOCKET_NAME_PATTERN = /^[a-f0-9]{64}[.]sock$/;
const HOSTNAME_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const UNSAFE_PATH_CHARACTERS = /[,\r\n\u0000]/;

function fail(message: string): never {
  throw new Error(message);
}

function safeUuid(value: string, label: string): string {
  if (!UUID_PATTERN.test(value)) fail(`${label} must be a canonical UUID.`);
  return value;
}

function safeProvider(value: ExternalProviderKind): ExternalProviderKind {
  if (value !== "httpx" && value !== "nuclei") fail("External provider kind is invalid.");
  return value;
}

function safeAbsolutePath(value: string, label: string): string {
  if (!path.isAbsolute(value) || UNSAFE_PATH_CHARACTERS.test(value)) {
    fail(`${label} must be an injection-safe absolute path.`);
  }
  return path.normalize(value);
}

function safePodmanBinary(value: string): string {
  const binary = safeAbsolutePath(value, "Podman binary");
  if (path.basename(binary) !== "podman") {
    fail("Podman binary path must resolve to the podman executable name.");
  }
  return binary;
}

function safeImage(value: string, label: string): string {
  if (!IMAGE_DIGEST_PATTERN.test(value) || value.includes("://")) {
    fail(`${label} must be a lowercase immutable OCI digest reference.`);
  }
  return value;
}

function safeSocketPath(value: string): string {
  const normalized = safeAbsolutePath(value, "Provider egress socket path");
  if (path.dirname(normalized) !== PROVIDER_EGRESS_HOST_SOCKET_ROOT
      || !SOCKET_NAME_PATTERN.test(path.basename(normalized))) {
    fail("Provider egress socket path is outside the fixed supervisor-owned root.");
  }
  return normalized;
}

function safeNonce(value: string): string {
  if (!SHA256_PATTERN.test(value)) fail("Provider egress session nonce is invalid.");
  return value;
}

function safeHostname(value: string): string {
  const hostname = value.trim().toLowerCase();
  if (!HOSTNAME_PATTERN.test(hostname)
      || hostname.length > 253
      || hostname.endsWith(".")
      || hostname === "localhost"
      || hostname.endsWith(".localhost")
      || hostname.endsWith(".local")
      || hostname.endsWith(".internal")) {
    fail("Trusted provider hostname is invalid.");
  }
  return hostname;
}

function safePort(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    fail("Trusted provider port is invalid.");
  }
  return value;
}

function safeProviderArgs(args: readonly string[]): readonly string[] {
  if (args.length < 1 || args.length > 64) fail("Provider argument count is invalid.");
  for (const value of args) {
    if (typeof value !== "string"
        || value.length < 1
        || value.length > 2048
        || /[\r\n\u0000]/.test(value)) {
      fail("Provider argument is invalid.");
    }
  }
  return Object.freeze([...args]);
}

function providerEntrypoint(provider: ExternalProviderKind): string {
  return provider === "httpx"
    ? "/app/httpx-worker-entry.js"
    : "/app/nuclei-worker-entry.js";
}

export function buildExternalProviderSandboxPlan(
  input: ExternalProviderSandboxInput,
): Readonly<ExternalProviderSandboxPlan> {
  const taskId = safeUuid(input.taskId, "Task identifier");
  const attemptId = safeUuid(input.attemptId, "Attempt identifier");
  const provider = safeProvider(input.provider);
  const file = safePodmanBinary(input.podmanBinary);
  const providerImage = safeImage(input.providerImage, "Provider image");
  const sidecarImage = safeImage(input.sidecarImage, "Sidecar image");
  const egressSocketPath = safeSocketPath(input.egressSocketPath);
  const sessionNonce = safeNonce(input.sessionNonce);
  const trustedHostname = safeHostname(input.trustedHostname);
  const port = safePort(input.port);
  const providerArgs = safeProviderArgs(input.providerArgs);

  const suffix = `${taskId}-${attemptId}`;
  const sidecarName = `scopeforge-provider-egress-${suffix}`;
  const providerName = `scopeforge-${provider}-${suffix}`;

  const common = [
    "--pull=never",
    "--read-only",
    "--read-only-tmpfs=false",
    "--cap-drop=all",
    "--security-opt=no-new-privileges",
    "--memory=256m",
    "--cgroup-conf=memory.swap.max=0",
    "--cpus=0.5",
    "--log-driver=none",
    "--user=65532:65532",
    "--unsetenv-all",
    "--tmpfs=/tmp:rw,size=8388608,mode=1777,nosuid,nodev,noexec",
  ] as const;

  const sidecar = Object.freeze({
    file,
    containerName: sidecarName,
    args: Object.freeze([
      "create",
      "--name", sidecarName,
      ...common,
      "--network=none",
      "--pids-limit=8",
      `--mount=type=bind,src=${egressSocketPath},dst=${PROVIDER_EGRESS_CONTAINER_SOCKET_PATH},ro`,
      sidecarImage,
      "--trusted-hostname", trustedHostname,
      "--port", String(port),
      "--session-nonce", sessionNonce,
    ]),
  });

  const providerCommand = Object.freeze({
    file,
    containerName: providerName,
    args: Object.freeze([
      "create",
      "--name", providerName,
      ...common,
      "--pids-limit=32",
      `--network=container:${sidecarName}`,
      "--entrypoint=/usr/local/bin/node",
      providerImage,
      providerEntrypoint(provider),
      ...providerArgs,
    ]),
  });

  return Object.freeze({
    sidecar,
    provider: providerCommand,
    sidecarName,
    providerName,
  });
}
