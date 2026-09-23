import type {
  NucleiProviderRequest,
  NucleiSeverity,
  NucleiTemplateProfile,
} from "../provider-nuclei";
import { NUCLEI_RUNTIME_PROFILES } from "../provider-nuclei/runtime-profile";
import type { ProviderExecutionContext } from "../capability-registry/types";

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,191}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HOST = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i;
const SEVERITIES = new Set<NucleiSeverity>(["info", "low", "medium", "high", "critical"]);

export interface NucleiContainerInput {
  request: NucleiProviderRequest & { approvedTemplateIds: readonly string[] };
  context: ProviderExecutionContext;
  target: Readonly<{ hostname: string; scheme: "http" | "https"; port: number }>;
}

function pairs(argv: readonly string[]): Map<string, string> {
  if (argv.length % 2 !== 0) throw new Error("NUCLEI_CONTAINER_ARGUMENTS_INVALID");
  const out = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined || out.has(key)) {
      throw new Error("NUCLEI_CONTAINER_ARGUMENTS_INVALID");
    }
    out.set(key, value);
  }
  return out;
}

function required(map: Map<string, string>, key: string): string {
  const value = map.get(key);
  if (!value) throw new Error(`NUCLEI_CONTAINER_ARGUMENT_REQUIRED:${key}`);
  return value;
}

function integer(value: string, min: number, max: number, label: string): number {
  if (!/^\d+$/.test(value)) throw new Error(`${label}_INVALID`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new Error(`${label}_INVALID`);
  return parsed;
}

export function parseNucleiContainerInput(argv: readonly string[]): Readonly<NucleiContainerInput> {
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
    "--template-profile",
    "--minimum-severity",
  ]);
  if ([...map.keys()].some((key) => !allowed.has(key))) throw new Error("NUCLEI_CONTAINER_ARGUMENT_UNKNOWN");

  const workspaceId = required(map, "--workspace-id");
  if (!UUID.test(workspaceId)) throw new Error("NUCLEI_CONTAINER_WORKSPACE_INVALID");

  const actionId = required(map, "--action-id");
  const authorizationId = required(map, "--authorization-id");
  const targetNodeId = required(map, "--target-node-id");
  for (const [value, code] of [
    [actionId, "NUCLEI_CONTAINER_ACTION_INVALID"],
    [authorizationId, "NUCLEI_CONTAINER_AUTHORIZATION_INVALID"],
    [targetNodeId, "NUCLEI_CONTAINER_TARGET_NODE_INVALID"],
  ] as const) {
    if (!SAFE_ID.test(value)) throw new Error(code);
  }

  const hostname = required(map, "--trusted-hostname").toLowerCase();
  if (!HOST.test(hostname) || hostname.length > 253) throw new Error("NUCLEI_CONTAINER_HOST_INVALID");
  const scheme = required(map, "--scheme");
  if (scheme !== "http" && scheme !== "https") throw new Error("NUCLEI_CONTAINER_SCHEME_INVALID");
  const port = integer(required(map, "--port"), 1, 65535, "NUCLEI_CONTAINER_PORT");
  const maxRuntimeMs = integer(required(map, "--max-runtime-ms"), 1, 10_000, "NUCLEI_CONTAINER_RUNTIME");

  const templateProfile = required(map, "--template-profile") as NucleiTemplateProfile;
  const approvedTemplateIds = NUCLEI_RUNTIME_PROFILES.profiles[templateProfile];
  if (!approvedTemplateIds?.length) throw new Error("NUCLEI_CONTAINER_PROFILE_DISABLED");

  const minimumSeverity = required(map, "--minimum-severity") as NucleiSeverity;
  if (!SEVERITIES.has(minimumSeverity)) throw new Error("NUCLEI_CONTAINER_SEVERITY_INVALID");

  return Object.freeze({
    target: Object.freeze({ hostname, scheme, port }),
    request: Object.freeze({
      capabilityId: "web.template.validate.v1",
      targetNodeId,
      templateProfile,
      minimumSeverity,
      approvedTemplateIds,
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
