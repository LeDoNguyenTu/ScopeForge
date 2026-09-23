import type { ProviderExecutionContext } from "../capability-registry/types";
import type { NucleiRunnerRequest } from "../provider-nuclei";
import {
  NUCLEI_INITIAL_TEMPLATE_ID,
  NUCLEI_RUNTIME_PROVIDER_CONFIG,
} from "./runtime-config";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,191}$/;

export interface NucleiContainerInput {
  request: NucleiRunnerRequest;
  context: ProviderExecutionContext;
  trustedHostname: string;
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

function integer(value: string, min: number, max: number, code: string): number {
  if (!/^\d+$/.test(value)) throw new Error(code);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new Error(code);
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
    "--max-runtime-ms",
  ]);
  if ([...map.keys()].some((key) => !allowed.has(key))) {
    throw new Error("NUCLEI_CONTAINER_ARGUMENT_UNKNOWN");
  }

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

  const maxRuntimeMs = integer(
    required(map, "--max-runtime-ms"),
    1,
    8_000,
    "NUCLEI_CONTAINER_RUNTIME_INVALID",
  );

  return Object.freeze({
    trustedHostname: required(map, "--trusted-hostname"),
    request: Object.freeze({
      capabilityId: "web.template.validate.v1",
      targetNodeId,
      templateProfile: "baseline-http",
      minimumSeverity: "info",
      approvedTemplateIds: NUCLEI_RUNTIME_PROVIDER_CONFIG.profiles["baseline-http"]
        ?? Object.freeze([NUCLEI_INITIAL_TEMPLATE_ID]),
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
