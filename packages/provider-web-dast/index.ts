import {
  addObservedEdge,
  addObservedNode,
  phase11StableId,
  type AssetNode,
  type Observation,
  type PrimitiveFacts,
  type SecurityGraph,
} from "../security-planning";
import type {
  CapabilityProvider,
  ProviderExecutionContext,
  ProviderNormalizationContext,
  ProviderPolicyContext,
} from "../capability-registry/types";

export const WEB_DAST_PROVIDER_ID = "scopeforge.web-dast";
export const WEB_DAST_PROVIDER_VERSION = "1.0.0";
export const WEB_DAST_CAPABILITIES = Object.freeze([
  "web.route.discover.v1",
  "api.schema.discover.v1",
  "api.operation.observe.v1",
] as const);

export type WebDastCapabilityId = (typeof WEB_DAST_CAPABILITIES)[number];
export type WebDastDiscoveryProfile = "root-openapi-v1";

export interface WebDastRequest {
  capabilityId: WebDastCapabilityId;
  targetNodeId: string;
  discoveryProfile: WebDastDiscoveryProfile;
}

export interface WebDastTransportResponse {
  status: number;
  contentType?: string;
  location?: string;
  body: string;
}

export interface WebDastTransport {
  request(input: {
    url: string;
    method: "GET";
    maxBodyBytes: number;
    signal: AbortSignal;
  }): Promise<WebDastTransportResponse>;
}

export interface WebDastTargetResolver {
  resolve(targetNodeId: string): Promise<string>;
}

export interface WebDastRouteRecord {
  path: "/" | "/openapi.json";
  status: number;
  contentType?: string;
  evidenceRef: string;
  observedAt: string;
}

export interface WebDastOperationRecord {
  method: "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";
  path: string;
  parameterCount: number;
  evidenceRef: string;
  observedAt: string;
}

export interface WebDastRawResult {
  capabilityId: WebDastCapabilityId;
  actionId: string;
  targetNodeId: string;
  discoveryProfile: WebDastDiscoveryProfile;
  schemaVersion?: string;
  routes: readonly WebDastRouteRecord[];
  operations: readonly WebDastOperationRecord[];
  requestCount: number;
}

const REQUEST_KEYS = new Set(["capabilityId", "targetNodeId", "discoveryProfile"]);
const MAX_BODY_BYTES = 64 * 1024;
const MAX_PATHS = 32;
const MAX_OPERATIONS = 64;
const MAX_PARAMETERS = 16;
const METHODS = new Set(["get", "head", "post", "put", "patch", "delete", "options"]);
const OUTPUT_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedRequest(input: unknown): Readonly<WebDastRequest> | null {
  if (!isRecord(input) || Object.keys(input).some((key) => !REQUEST_KEYS.has(key))) return null;
  if (!WEB_DAST_CAPABILITIES.includes(input.capabilityId as WebDastCapabilityId)) return null;
  if (typeof input.targetNodeId !== "string" || !input.targetNodeId.trim()) return null;
  if (input.discoveryProfile !== "root-openapi-v1") return null;
  return Object.freeze({
    capabilityId: input.capabilityId as WebDastCapabilityId,
    targetNodeId: input.targetNodeId.trim(),
    discoveryProfile: "root-openapi-v1" as const,
  });
}

function sameOriginTarget(locator: string): URL {
  const url = new URL(locator);
  const loopbackLab = url.protocol === "http:" && url.hostname === "127.0.0.1";
  if ((url.protocol !== "https:" && !loopbackLab) || url.username || url.password || url.search || url.hash) {
    throw new Error("WEB_DAST_TARGET_INVALID");
  }
  return url;
}

function boundedContentType(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const clean = value.trim().slice(0, 120);
  return clean && !/[\r\n\0]/.test(clean) ? clean : undefined;
}

function facts(input: Record<string, string | number | boolean | undefined>): PrimitiveFacts {
  return Object.freeze(Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined))) as PrimitiveFacts;
}

function evidenceRef(actionId: string, path: string, status: number): string {
  return phase11StableId("phase11-web-dast-evidence", [actionId, path, String(status)]);
}

function parseOpenApi(body: string, actionId: string, observedAt: string): {
  schemaVersion: string;
  operations: readonly WebDastOperationRecord[];
} {
  if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) throw new Error("WEB_DAST_SCHEMA_BODY_LIMIT");
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("WEB_DAST_SCHEMA_INVALID");
  }
  if (!isRecord(parsed) || typeof parsed.openapi !== "string" || !/^3(?:\.\d+){1,2}$/.test(parsed.openapi)) {
    throw new Error("WEB_DAST_SCHEMA_INVALID");
  }
  if (!isRecord(parsed.paths)) throw new Error("WEB_DAST_SCHEMA_PATHS_INVALID");
  const entries = Object.entries(parsed.paths).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length > MAX_PATHS) throw new Error("WEB_DAST_SCHEMA_PATH_LIMIT");

  const operations: WebDastOperationRecord[] = [];
  for (const [path, pathItem] of entries) {
    if (!path.startsWith("/") || path.length > 240 || /[\r\n\0]/.test(path) || !isRecord(pathItem)) {
      throw new Error("WEB_DAST_SCHEMA_PATH_INVALID");
    }
    for (const [method, operation] of Object.entries(pathItem).sort(([a], [b]) => a.localeCompare(b))) {
      if (!METHODS.has(method)) continue;
      if (!isRecord(operation)) throw new Error("WEB_DAST_SCHEMA_OPERATION_INVALID");
      const parameters = operation.parameters ?? [];
      if (!Array.isArray(parameters) || parameters.length > MAX_PARAMETERS) {
        throw new Error("WEB_DAST_SCHEMA_PARAMETER_LIMIT");
      }
      const outputMethod = method.toUpperCase();
      if (!OUTPUT_METHODS.has(outputMethod)) throw new Error("WEB_DAST_SCHEMA_METHOD_INVALID");
      operations.push(Object.freeze({
        method: outputMethod as WebDastOperationRecord["method"],
        path,
        parameterCount: parameters.length,
        evidenceRef: phase11StableId("phase11-web-dast-operation", [actionId, outputMethod, path]),
        observedAt,
      }));
      if (operations.length > MAX_OPERATIONS) throw new Error("WEB_DAST_SCHEMA_OPERATION_LIMIT");
    }
  }

  return Object.freeze({
    schemaVersion: parsed.openapi,
    operations: Object.freeze(operations),
  });
}

export function createBoundedWebDastRunner(dependencies: {
  resolver: WebDastTargetResolver;
  transport: WebDastTransport;
  now?: () => Date;
}) {
  return Object.freeze({
    async run(
      request: Readonly<WebDastRequest>,
      context: Readonly<ProviderExecutionContext>,
      signal: AbortSignal,
    ): Promise<WebDastRawResult> {
      if (context.maxRequests < 2) throw new Error("WEB_DAST_REQUEST_BUDGET_TOO_SMALL");
      const root = sameOriginTarget(await dependencies.resolver.resolve(request.targetNodeId));
      const origin = root.origin;
      const paths = ["/", "/openapi.json"] as const;
      const routes: WebDastRouteRecord[] = [];
      let schemaVersion: string | undefined;
      let operations: readonly WebDastOperationRecord[] = [];
      const observedAt = (dependencies.now ?? (() => new Date()))().toISOString();

      for (const path of paths) {
        const target = new URL(path, origin);
        if (target.origin !== origin) throw new Error("WEB_DAST_ORIGIN_DRIFT");
        const response = await dependencies.transport.request({
          url: target.toString(),
          method: "GET",
          maxBodyBytes: MAX_BODY_BYTES,
          signal,
        });
        if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599) {
          throw new Error("WEB_DAST_RESPONSE_STATUS_INVALID");
        }
        if (response.location) {
          const redirected = new URL(response.location, target);
          if (redirected.origin !== origin) throw new Error("WEB_DAST_REDIRECT_OUT_OF_SCOPE");
          throw new Error("WEB_DAST_REDIRECT_NOT_FOLLOWED");
        }
        if (Buffer.byteLength(response.body, "utf8") > MAX_BODY_BYTES) throw new Error("WEB_DAST_RESPONSE_BODY_LIMIT");
        routes.push(Object.freeze({
          path,
          status: response.status,
          contentType: boundedContentType(response.contentType),
          evidenceRef: evidenceRef(context.actionId, path, response.status),
          observedAt,
        }));

        if (path === "/openapi.json" && response.status >= 200 && response.status < 300) {
          const parsed = parseOpenApi(response.body, context.actionId, observedAt);
          schemaVersion = parsed.schemaVersion;
          operations = parsed.operations;
        }
      }

      return Object.freeze({
        capabilityId: request.capabilityId,
        actionId: context.actionId,
        targetNodeId: request.targetNodeId,
        discoveryProfile: request.discoveryProfile,
        ...(schemaVersion ? { schemaVersion } : {}),
        routes: Object.freeze(routes),
        operations,
        requestCount: paths.length,
      });
    },
  });
}

export function createWebDastProvider(runner: ReturnType<typeof createBoundedWebDastRunner>): CapabilityProvider<WebDastRequest, WebDastRawResult> {
  return Object.freeze({
    providerId: WEB_DAST_PROVIDER_ID,
    version: WEB_DAST_PROVIDER_VERSION,
    capabilityIds: WEB_DAST_CAPABILITIES,
    supportedModes: Object.freeze(["safe_active"] as const),
    validateRequest(request: WebDastRequest, context: ProviderPolicyContext) {
      if (!normalizedRequest(request)) return { ok: false as const, code: "WEB_DAST_REQUEST_INVALID" };
      if (context.executionMode !== "safe_active") return { ok: false as const, code: "WEB_DAST_MODE_UNSUPPORTED" };
      return { ok: true as const };
    },
    async execute(request: WebDastRequest, context: ProviderExecutionContext, signal: AbortSignal) {
      const normalized = normalizedRequest(request);
      if (!normalized) throw new Error("WEB_DAST_REQUEST_INVALID");
      if (!context.targetNodeIds.includes(normalized.targetNodeId)) throw new Error("WEB_DAST_TARGET_BINDING_INVALID");
      const raw = await runner.run(normalized, context, signal);
      if (raw.actionId !== context.actionId || raw.targetNodeId !== normalized.targetNodeId) {
        throw new Error("WEB_DAST_RESULT_BINDING_INVALID");
      }
      if (raw.requestCount > 2) throw new Error("WEB_DAST_REQUEST_LIMIT_EXCEEDED");
      return raw;
    },
    async normalize(raw: WebDastRawResult, context: ProviderNormalizationContext) {
      if (!WEB_DAST_CAPABILITIES.includes(raw.capabilityId)) throw new Error("WEB_DAST_RESULT_CAPABILITY_INVALID");
      if (raw.actionId !== context.actionId || !raw.targetNodeId.trim()) throw new Error("WEB_DAST_RESULT_BINDING_INVALID");
      if (raw.discoveryProfile !== "root-openapi-v1" || raw.requestCount < 0 || raw.requestCount > 2) {
        throw new Error("WEB_DAST_RESULT_PROFILE_INVALID");
      }
      if (raw.routes.length > 2 || raw.operations.length > MAX_OPERATIONS) throw new Error("WEB_DAST_RESULT_LIMIT_EXCEEDED");

      const observations: Observation[] = [];
      for (const route of raw.routes) {
        if (route.path !== "/" && route.path !== "/openapi.json") throw new Error("WEB_DAST_ROUTE_INVALID");
        observations.push(Object.freeze({
          observationId: phase11StableId("phase11-obs-web-route", [context.actionId, raw.targetNodeId, route.path, String(route.status)]),
          runId: context.runId,
          providerId: WEB_DAST_PROVIDER_ID,
          providerVersion: WEB_DAST_PROVIDER_VERSION,
          capabilityId: "web.route.discover.v1",
          assetNodeIds: Object.freeze([raw.targetNodeId]),
          evidenceRefs: Object.freeze([route.evidenceRef]),
          facts: facts({ kind: "web.route.discover.v1", path: route.path, status: route.status, contentType: route.contentType }),
          observedAt: new Date(route.observedAt).toISOString(),
          confidence: 0.98,
          authorizationSnapshotRef: context.authorizationSnapshotRef,
          executionMode: "safe_active",
        }));
      }

      if (raw.schemaVersion) {
        observations.push(Object.freeze({
          observationId: phase11StableId("phase11-obs-api-schema", [context.actionId, raw.targetNodeId, raw.schemaVersion]),
          runId: context.runId,
          providerId: WEB_DAST_PROVIDER_ID,
          providerVersion: WEB_DAST_PROVIDER_VERSION,
          capabilityId: "api.schema.discover.v1",
          assetNodeIds: Object.freeze([raw.targetNodeId]),
          evidenceRefs: Object.freeze(raw.routes.filter((route) => route.path === "/openapi.json").map((route) => route.evidenceRef)),
          facts: facts({ kind: "api.schema.discover.v1", schemaVersion: raw.schemaVersion, operationCount: raw.operations.length }),
          observedAt: raw.routes.find((route) => route.path === "/openapi.json")?.observedAt ?? new Date(0).toISOString(),
          confidence: 0.99,
          authorizationSnapshotRef: context.authorizationSnapshotRef,
          executionMode: "safe_active",
        }));
      }

      for (const operation of raw.operations) {
        if (!OUTPUT_METHODS.has(operation.method) || !operation.path.startsWith("/") || operation.parameterCount > MAX_PARAMETERS) {
          throw new Error("WEB_DAST_OPERATION_INVALID");
        }
        observations.push(Object.freeze({
          observationId: phase11StableId("phase11-obs-api-operation", [context.actionId, raw.targetNodeId, operation.method, operation.path]),
          runId: context.runId,
          providerId: WEB_DAST_PROVIDER_ID,
          providerVersion: WEB_DAST_PROVIDER_VERSION,
          capabilityId: "api.operation.observe.v1",
          assetNodeIds: Object.freeze([raw.targetNodeId]),
          evidenceRefs: Object.freeze([operation.evidenceRef]),
          facts: facts({ kind: "api.operation.observe.v1", method: operation.method, path: operation.path, parameterCount: operation.parameterCount }),
          observedAt: new Date(operation.observedAt).toISOString(),
          confidence: 0.99,
          authorizationSnapshotRef: context.authorizationSnapshotRef,
          executionMode: "safe_active",
        }));
      }

      return Object.freeze(observations.sort((a, b) => a.observationId.localeCompare(b.observationId)));
    },
    async cleanup() {
      return { ok: true as const };
    },
  });
}

export function expandWebDastGraph(input: {
  graph: SecurityGraph;
  rootNodeId: string;
  observations: readonly Observation[];
}): SecurityGraph {
  const root = input.graph.nodes.find((node) => node.assetNodeId === input.rootNodeId);
  if (!root) throw new Error("WEB_DAST_ROOT_NODE_UNKNOWN");
  const schema = input.observations.find((observation) =>
    observation.capabilityId === "api.schema.discover.v1" && observation.assetNodeIds.includes(root.assetNodeId)
  );
  if (!schema) return input.graph;

  const apiId = phase11StableId("phase11-api-node", [root.assetNodeId, root.canonicalLocator]);
  const apiNode: AssetNode = Object.freeze({
    assetNodeId: apiId,
    assetType: "api",
    canonicalLocator: `${root.canonicalLocator}#api`,
    parentNodeIds: Object.freeze([root.assetNodeId]),
    authorizationRef: root.authorizationRef,
    technologyTags: Object.freeze(["openapi"]),
    confidence: schema.confidence,
    provenanceRefs: schema.evidenceRefs,
  });
  let graph = addObservedNode(input.graph, apiNode);
  graph = addObservedEdge(graph, {
    fromNodeId: root.assetNodeId,
    toNodeId: apiId,
    relationship: "exposes",
    provenanceKind: "observed",
    provenanceRefs: schema.evidenceRefs,
    confidence: schema.confidence,
    observedAt: schema.observedAt,
    authorizationRef: root.authorizationRef,
    stale: false,
  });

  const operations = input.observations
    .filter((observation) => observation.capabilityId === "api.operation.observe.v1")
    .sort((a, b) => a.observationId.localeCompare(b.observationId));

  for (const observation of operations) {
    const method = observation.facts.method;
    const path = observation.facts.path;
    if (typeof method !== "string" || typeof path !== "string") throw new Error("WEB_DAST_OPERATION_FACTS_INVALID");
    const nodeId = phase11StableId("phase11-api-operation-node", [apiId, method, path]);
    graph = addObservedNode(graph, {
      assetNodeId: nodeId,
      assetType: "api_operation",
      canonicalLocator: `${root.canonicalLocator}#${method} ${path}`,
      parentNodeIds: Object.freeze([apiId]),
      authorizationRef: root.authorizationRef,
      technologyTags: Object.freeze(["openapi-operation"]),
      confidence: observation.confidence,
      provenanceRefs: observation.evidenceRefs,
    });
    graph = addObservedEdge(graph, {
      fromNodeId: apiId,
      toNodeId: nodeId,
      relationship: "contains",
      provenanceKind: "observed",
      provenanceRefs: observation.evidenceRefs,
      confidence: observation.confidence,
      observedAt: observation.observedAt,
      authorizationRef: root.authorizationRef,
      stale: false,
    });
  }
  return graph;
}
