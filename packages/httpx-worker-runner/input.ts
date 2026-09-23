import type { HttpxProbe, HttpxProviderRequest, HttpxScheme } from "../provider-httpx";
import type { ProviderExecutionContext } from "../capability-registry/types";

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,191}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PROBES = new Set<HttpxProbe>(["status", "title", "server", "content_type", "tls", "tech"]);

export interface HttpxContainerInput {
  request: HttpxProviderRequest;
  context: ProviderExecutionContext;
  trustedHostname: string;
}

function pairs(argv: readonly string[]): Map<string, string> {
  if (argv.length % 2 !== 0) throw new Error("HTTPX_CONTAINER_ARGUMENTS_INVALID");
  const out = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined || out.has(key)) {
      throw new Error("HTTPX_CONTAINER_ARGUMENTS_INVALID");
    }
    out.set(key, value);
  }
  return out;
}

function required(map: Map<string, string>, key: string): string {
  const value = map.get(key);
  if (!value) throw new Error(`HTTPX_CONTAINER_ARGUMENT_REQUIRED:${key}`);
  return value;
}

function integer(value: string, min: number, max: number, label: string): number {
  if (!/^\d+$/.test(value)) throw new Error(`${label}_INVALID`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new Error(`${label}_INVALID`);
  return parsed;
}

export function parseHttpxContainerInput(argv: readonly string[]): Readonly<HttpxContainerInput> {
  const map = pairs(argv);
  const allowed = new Set([
    "--workspace-id",
    "--action-id",
    "--authorization-id",
    "--target-node-id",
    "--trusted-hostname",
    "--scheme",
    "--port",
    "--max-runtime-ms",
    "--probes",
  ]);
  if ([...map.keys()].some((key) => !allowed.has(key))) throw new Error("HTTPX_CONTAINER_ARGUMENT_UNKNOWN");

  const workspaceId = required(map, "--workspace-id");
  if (!UUID.test(workspaceId)) throw new Error("HTTPX_CONTAINER_WORKSPACE_INVALID");

  const actionId = required(map, "--action-id");
  const authorizationId = required(map, "--authorization-id");
  const targetNodeId = required(map, "--target-node-id");
  for (const [value, code] of [
    [actionId, "HTTPX_CONTAINER_ACTION_INVALID"],
    [authorizationId, "HTTPX_CONTAINER_AUTHORIZATION_INVALID"],
    [targetNodeId, "HTTPX_CONTAINER_TARGET_NODE_INVALID"],
  ] as const) {
    if (!SAFE_ID.test(value)) throw new Error(code);
  }

  const trustedHostname = required(map, "--trusted-hostname");
  const scheme = required(map, "--scheme") as HttpxScheme;
  if (scheme !== "http" && scheme !== "https") throw new Error("HTTPX_CONTAINER_SCHEME_INVALID");
  const port = integer(required(map, "--port"), 1, 65535, "HTTPX_CONTAINER_PORT");
  const maxRuntimeMs = integer(required(map, "--max-runtime-ms"), 1, 8_000, "HTTPX_CONTAINER_RUNTIME");

  const probeText = required(map, "--probes");
  const probeValues = probeText.split(",").filter(Boolean);
  if (probeValues.length < 1 || probeValues.length > PROBES.size) throw new Error("HTTPX_CONTAINER_PROBES_INVALID");
  if (probeValues.some((probe) => !PROBES.has(probe as HttpxProbe))) throw new Error("HTTPX_CONTAINER_PROBES_INVALID");
  const probes = [...new Set(probeValues as HttpxProbe[])].sort();
  if (probes.length !== probeValues.length) throw new Error("HTTPX_CONTAINER_PROBES_INVALID");

  return Object.freeze({
    trustedHostname,
    request: Object.freeze({
      capabilityId: "web.http.probe.v1",
      targetNodeId,
      scheme,
      port,
      maxRedirects: 0,
      probes: Object.freeze(probes),
    }),
    context: Object.freeze({
      workspaceId,
      actionId,
      authorizationId,
      targetNodeIds: Object.freeze([targetNodeId]),
      maxRequests: 1,
      maxRuntimeMs,
    }),
  });
}
