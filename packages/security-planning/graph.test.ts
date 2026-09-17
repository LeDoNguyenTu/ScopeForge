import { describe, expect, it } from "vitest";
import {
  addObservedEdge,
  addObservedNode,
  deriveAttackPaths,
  emptyGraph,
  graphFingerprint,
  markEdgeStale,
} from "./graph";
import type { AssetNode } from "./types";

function node(assetNodeId: string, locator = assetNodeId): AssetNode {
  return {
    assetNodeId,
    assetType: "http_service",
    canonicalLocator: locator,
    parentNodeIds: [],
    authorizationRef: "auth-snapshot-1",
    technologyTags: [],
    confidence: 0.8,
    provenanceRefs: [`evidence-${assetNodeId}`],
  };
}

function edge(fromNodeId: string, toNodeId: string) {
  return {
    fromNodeId,
    toNodeId,
    relationship: "reachable_from" as const,
    provenanceKind: "observed" as const,
    provenanceRefs: [`evidence-${fromNodeId}-${toNodeId}`],
    confidence: 0.9,
    observedAt: "2026-09-18T00:00:00.000Z",
    authorizationRef: "auth-snapshot-1",
    stale: false,
  };
}

describe("Phase 11 security graph", () => {
  it("collapses equivalent nodes and preserves provenance deterministically", () => {
    const first = addObservedNode(emptyGraph(), node("node-a"));
    const second = addObservedNode(first, {
      ...node("node-a"),
      technologyTags: ["nginx"],
      provenanceRefs: ["evidence-node-a", "evidence-second"],
      confidence: 0.9,
    });
    const third = addObservedNode(second, {
      ...node("node-a"),
      technologyTags: ["nginx"],
      provenanceRefs: ["evidence-second"],
      confidence: 0.9,
    });

    expect(second.nodes).toHaveLength(1);
    expect(second.nodes[0].technologyTags).toEqual(["nginx"]);
    expect(second.nodes[0].provenanceRefs).toEqual(["evidence-node-a", "evidence-second"]);
    expect(graphFingerprint(second)).toBe(graphFingerprint(third));
  });

  it("rejects identity conflicts for an existing stable node id", () => {
    const graph = addObservedNode(emptyGraph(), node("node-a", "https://a.example"));
    expect(() => addObservedNode(graph, node("node-a", "https://b.example"))).toThrow("GRAPH_NODE_IDENTITY_CONFLICT");
  });

  it("collapses duplicate evidence-backed edges with a stable identity", () => {
    let graph = addObservedNode(emptyGraph(), node("node-a"));
    graph = addObservedNode(graph, node("node-b"));
    const once = addObservedEdge(graph, edge("node-a", "node-b"));
    const twice = addObservedEdge(once, edge("node-a", "node-b"));

    expect(twice.edges).toHaveLength(1);
    expect(graphFingerprint(once)).toBe(graphFingerprint(twice));
  });

  it("requires provenance and known endpoints before inserting a trusted edge", () => {
    let graph = addObservedNode(emptyGraph(), node("node-a"));
    graph = addObservedNode(graph, node("node-b"));

    expect(() => addObservedEdge(graph, { ...edge("node-a", "node-b"), provenanceRefs: [] }))
      .toThrow("GRAPH_EDGE_PROVENANCE_REQUIRED");
    expect(() => addObservedEdge(graph, edge("node-a", "node-missing")))
      .toThrow("GRAPH_EDGE_TARGET_UNKNOWN");
  });

  it("derives paths only across fresh evidence-backed edges", () => {
    let graph = emptyGraph();
    for (const id of ["a", "b", "c"]) graph = addObservedNode(graph, node(id));
    graph = addObservedEdge(graph, edge("a", "b"));
    graph = addObservedEdge(graph, edge("b", "c"));

    const paths = deriveAttackPaths(graph, ["a"]);
    expect(paths.map((path) => path.nodeIds)).toEqual([
      ["a", "b"],
      ["a", "b", "c"],
    ]);

    const stale = markEdgeStale(graph, graph.edges.find((candidate) => candidate.fromNodeId === "b")!.edgeId);
    expect(deriveAttackPaths(stale, ["a"]).map((path) => path.nodeIds)).toEqual([["a", "b"]]);
  });
});
