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
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,191}$/;
const UNSAFE_PATH_CHARACTERS = /[,\r\n\u0000]/;
const HTTPX_PROBES = new Set(["status", "title", "server", "content_type", "tls", "tech"]);
const NUCLEI_SEVERITIES = new Set(["info", "low", "medium", "high", "critical"]);

function fail(message: string): never {
  throw new Error(message);
}

function safeUuid(value: string, label: string): string {
  if (!UUID_PATTERN.test(value)) fail(`${label} must be a canonical UUID.`);
  return value;
}

function safeId(value: string, label: string): string {
  if (!SAFE_ID_PATTERN.test(value)) fail(`${label} is invalid.`);
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

function safeRuntime(value: number, provider: ExternalProviderKind): number {
  const max = provider === "httpx" ? 8_000 : 10_000;
  if (!Number.isInteger(value) || value < 1 || value > max) {
    fail("Provider runtime budget is invalid.");
  }
  return value;
}

function providerEntrypoint(provider: ExternalProviderKind): string {
  return provider === "httpx"
    ? "/app/httpx-worker-entry.js"
    : "/app/nuclei-worker-entry.js";
}

function providerRunnerArgs(
  input: ExternalProviderSandboxInput,
  trustedHostname: string,
  port: number,
): readonly string[] {
  const base = [
    "--workspace-id", safeUuid(input.workspaceId, "Workspace identifier"),
    "--action-id", safeId(input.actionId, "Action identifier"),
    "--authorization-id", safeId(input.authorizationId, "Authorization identifier"),
    "--target-node-id", safeId(input.targetNodeId, "Target-node identifier"),
    "--trusted-hostname", trustedHostname,
    "--scheme", input.scheme,
    "--port", String(port),
    "--max-runtime-ms", String(safeRuntime(input.maxRuntimeMs, input.provider)),
  ];

  if (input.provider === "httpx") {
    if (input.probes.length < 1 || input.probes.length > HTTPX_PROBES.size) {
      fail("httpx probe set is invalid.");
    }
    const probes = [...new Set(input.probes)];
    if (probes.length !== input.probes.length
        || probes.some((probe) => !HTTPX_PROBES.has(probe))) {
      fail("httpx probe set is invalid.");
    }
    return Object.freeze([...base, "--probes", [...probes].sort().join(",")]);
  }

  if (input.templateProfile !== "baseline-http"
      || !NUCLEI_SEVERITIES.has(input.minimumSeverity)) {
    fail("Nuclei runtime profile is invalid.");
  }
  return Object.freeze([
    ...base,
    "--template-profile", "baseline-http",
    "--minimum-severity", input.minimumSeverity,
  ]);
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
  const runnerArgs = providerRunnerArgs(input, trustedHostname, port);

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
      ...runnerArgs,
    ]),
  });

  return Object.freeze({
    sidecar,
    provider: providerCommand,
    sidecarName,
    providerName,
  });
}
