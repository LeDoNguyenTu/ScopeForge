import type { AssetNode } from "./types";

export type AttackRelationship =
  | "exposes"
  | "depends_on"
  | "authenticates_to"
  | "trusts"
  | "deploys_to"
  | "contains"
  | "reachable_from"
  | "affected_by"
  | "enables";

export type TrustedEdgeProvenanceKind = "observed" | "scanner-derived" | "user-confirmed";

export interface AssetEdge {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  relationship: AttackRelationship;
  provenanceKind: TrustedEdgeProvenanceKind;
  provenanceRefs: readonly string[];
  confidence: number;
  observedAt: string;
  authorizationRef: string;
  stale: boolean;
}

export interface ObservedEdgeInput extends Omit<AssetEdge, "edgeId"> {
  edgeId?: string;
}

export interface SecurityGraph {
  nodes: readonly AssetNode[];
  edges: readonly AssetEdge[];
}

export interface AttackPath {
  nodeIds: readonly string[];
  edgeIds: readonly string[];
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

function edgeIdentity(input: Pick<ObservedEdgeInput, "fromNodeId" | "toNodeId" | "relationship">): string {
  return [
    "edge",
    encodeURIComponent(input.fromNodeId),
    input.relationship,
    encodeURIComponent(input.toNodeId),
  ].join(":");
}

function normalizeNode(node: AssetNode): AssetNode {
  if (!node.assetNodeId.trim() || !node.canonicalLocator.trim() || !node.authorizationRef.trim()) {
    throw new Error("GRAPH_NODE_IDENTITY_INVALID");
  }
  if (!Number.isFinite(node.confidence) || node.confidence < 0 || node.confidence > 1) {
    throw new Error("GRAPH_NODE_CONFIDENCE_INVALID");
  }
  if (node.provenanceRefs.length === 0 || node.provenanceRefs.some((ref) => !ref.trim())) {
    throw new Error("GRAPH_NODE_PROVENANCE_REQUIRED");
  }

  return Object.freeze({
    ...node,
    parentNodeIds: uniqueSorted(node.parentNodeIds),
    technologyTags: uniqueSorted(node.technologyTags),
    provenanceRefs: uniqueSorted(node.provenanceRefs),
  });
}

function normalizeEdge(input: ObservedEdgeInput): AssetEdge {
  if (!input.fromNodeId.trim() || !input.toNodeId.trim() || input.fromNodeId === input.toNodeId) {
    throw new Error("GRAPH_EDGE_ENDPOINT_INVALID");
  }
  if (!input.authorizationRef.trim()) throw new Error("GRAPH_EDGE_AUTHORIZATION_REQUIRED");
  if (input.provenanceRefs.length === 0 || input.provenanceRefs.some((ref) => !ref.trim())) {
    throw new Error("GRAPH_EDGE_PROVENANCE_REQUIRED");
  }
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    throw new Error("GRAPH_EDGE_CONFIDENCE_INVALID");
  }
  if (!Number.isFinite(Date.parse(input.observedAt))) throw new Error("GRAPH_EDGE_TIMESTAMP_INVALID");

  return Object.freeze({
    ...input,
    edgeId: edgeIdentity(input),
    provenanceRefs: uniqueSorted(input.provenanceRefs),
  });
}

function mergeNode(existing: AssetNode, incoming: AssetNode): AssetNode {
  if (
    existing.assetType !== incoming.assetType
    || existing.canonicalLocator !== incoming.canonicalLocator
    || existing.authorizationRef !== incoming.authorizationRef
  ) {
    throw new Error("GRAPH_NODE_IDENTITY_CONFLICT");
  }

  return Object.freeze({
    ...existing,
    parentNodeIds: uniqueSorted([...existing.parentNodeIds, ...incoming.parentNodeIds]),
    technologyTags: uniqueSorted([...existing.technologyTags, ...incoming.technologyTags]),
    provenanceRefs: uniqueSorted([...existing.provenanceRefs, ...incoming.provenanceRefs]),
    confidence: Math.max(existing.confidence, incoming.confidence),
  });
}

function mergeEdge(existing: AssetEdge, incoming: AssetEdge): AssetEdge {
  if (
    existing.fromNodeId !== incoming.fromNodeId
    || existing.toNodeId !== incoming.toNodeId
    || existing.relationship !== incoming.relationship
    || existing.authorizationRef !== incoming.authorizationRef
  ) {
    throw new Error("GRAPH_EDGE_IDENTITY_CONFLICT");
  }

  return Object.freeze({
    ...existing,
    provenanceRefs: uniqueSorted([...existing.provenanceRefs, ...incoming.provenanceRefs]),
    confidence: Math.max(existing.confidence, incoming.confidence),
    observedAt: Date.parse(existing.observedAt) >= Date.parse(incoming.observedAt)
      ? existing.observedAt
      : incoming.observedAt,
    stale: existing.stale && incoming.stale,
  });
}

export function emptyGraph(): SecurityGraph {
  return Object.freeze({ nodes: Object.freeze([]), edges: Object.freeze([]) });
}

export function addObservedNode(graph: SecurityGraph, input: AssetNode): SecurityGraph {
  const node = normalizeNode(input);
  const existing = graph.nodes.find((candidate) => candidate.assetNodeId === node.assetNodeId);
  const nodes = existing
    ? graph.nodes.map((candidate) => candidate.assetNodeId === node.assetNodeId ? mergeNode(candidate, node) : candidate)
    : [...graph.nodes, node];

  return Object.freeze({
    nodes: Object.freeze([...nodes].sort((a, b) => a.assetNodeId.localeCompare(b.assetNodeId))),
    edges: graph.edges,
  });
}

export function addObservedEdge(graph: SecurityGraph, input: ObservedEdgeInput): SecurityGraph {
  const edge = normalizeEdge(input);
  if (!graph.nodes.some((node) => node.assetNodeId === edge.fromNodeId)) {
    throw new Error("GRAPH_EDGE_SOURCE_UNKNOWN");
  }
  if (!graph.nodes.some((node) => node.assetNodeId === edge.toNodeId)) {
    throw new Error("GRAPH_EDGE_TARGET_UNKNOWN");
  }

  const existing = graph.edges.find((candidate) => candidate.edgeId === edge.edgeId);
  const edges = existing
    ? graph.edges.map((candidate) => candidate.edgeId === edge.edgeId ? mergeEdge(candidate, edge) : candidate)
    : [...graph.edges, edge];

  return Object.freeze({
    nodes: graph.nodes,
    edges: Object.freeze([...edges].sort((a, b) => a.edgeId.localeCompare(b.edgeId))),
  });
}

export function markEdgeStale(graph: SecurityGraph, edgeId: string): SecurityGraph {
  if (!graph.edges.some((edge) => edge.edgeId === edgeId)) return graph;
  return Object.freeze({
    nodes: graph.nodes,
    edges: Object.freeze(graph.edges.map((edge) => edge.edgeId === edgeId ? Object.freeze({ ...edge, stale: true }) : edge)),
  });
}

export function deriveAttackPaths(
  graph: SecurityGraph,
  startNodeIds: readonly string[],
  maxDepth = 6,
): readonly AttackPath[] {
  if (!Number.isInteger(maxDepth) || maxDepth < 1) throw new Error("GRAPH_PATH_DEPTH_INVALID");

  const known = new Set(graph.nodes.map((node) => node.assetNodeId));
  const starts = uniqueSorted(startNodeIds.filter((nodeId) => known.has(nodeId)));
  const adjacency = new Map<string, AssetEdge[]>();

  for (const edge of graph.edges) {
    if (edge.stale || edge.provenanceRefs.length === 0) continue;
    const list = adjacency.get(edge.fromNodeId) ?? [];
    list.push(edge);
    adjacency.set(edge.fromNodeId, list);
  }
  for (const list of adjacency.values()) list.sort((a, b) => a.edgeId.localeCompare(b.edgeId));

  const paths: AttackPath[] = [];
  const walk = (nodeId: string, nodeIds: string[], edgeIds: string[], depth: number): void => {
    if (depth >= maxDepth) return;
    for (const edge of adjacency.get(nodeId) ?? []) {
      if (nodeIds.includes(edge.toNodeId)) continue;
      const nextNodes = [...nodeIds, edge.toNodeId];
      const nextEdges = [...edgeIds, edge.edgeId];
      paths.push(Object.freeze({ nodeIds: Object.freeze(nextNodes), edgeIds: Object.freeze(nextEdges) }));
      walk(edge.toNodeId, nextNodes, nextEdges, depth + 1);
    }
  };

  for (const start of starts) walk(start, [start], [], 0);
  return Object.freeze(paths);
}

export function graphFingerprint(graph: SecurityGraph): string {
  const canonical = {
    nodes: [...graph.nodes]
      .sort((a, b) => a.assetNodeId.localeCompare(b.assetNodeId))
      .map((node) => ({
        ...node,
        parentNodeIds: [...node.parentNodeIds].sort(),
        technologyTags: [...node.technologyTags].sort(),
        provenanceRefs: [...node.provenanceRefs].sort(),
      })),
    edges: [...graph.edges]
      .sort((a, b) => a.edgeId.localeCompare(b.edgeId))
      .map((edge) => ({ ...edge, provenanceRefs: [...edge.provenanceRefs].sort() })),
  };
  return JSON.stringify(canonical);
}
