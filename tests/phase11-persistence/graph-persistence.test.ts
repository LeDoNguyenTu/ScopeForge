import { describe, expect, it, vi } from "vitest";
import {
  listPentestGraphEdges,
  listPentestGraphNodes,
  persistPentestGraphState,
} from "@/lib/pentest-graph/persistence";
import type { Phase11ReadClient, Phase11RpcClient } from "@/lib/database.phase11.types";
import type { SecurityGraph } from "@/packages/security-planning";

const graph: SecurityGraph = {
  nodes: [{
    assetNodeId: "node-1",
    assetType: "http_service",
    canonicalLocator: "https://secret.example/internal",
    parentNodeIds: [],
    authorizationRef: "authz-snapshot-1",
    technologyTags: ["nginx"],
    confidence: 0.9,
    provenanceRefs: ["evidence-1"],
  }],
  edges: [],
};

const coverage = {
  attemptedCapabilityIds: [],
  coveredNodeIds: [],
  untestedNodeIds: ["node-1"],
  requestCount: 0,
  graphExpansionCount: 0,
  providerFailureCount: 0,
  startedAt: "2026-09-18T00:00:00.000Z",
  deadlineAt: "2026-09-18T00:10:00.000Z",
};

describe("Phase 11 graph persistence service", () => {
  it("serializes canonical graph state only into the trusted RPC", async () => {
    const rpc = vi.fn(async () => ({
      data: { nodeCount: 1, edgeCount: 0, hypothesisCount: 0, eventCount: 1 },
      error: null,
    }));
    const result = await persistPentestGraphState({ rpc } as Phase11RpcClient, {
      workspaceId: "workspace-1",
      runId: "run-1",
      authorizationSnapshotRef: "authz-snapshot-1",
      graph,
      hypotheses: [],
      coverage,
      events: [{
        id: "11111111-1111-4111-8111-111111111111",
        eventType: "graph.updated",
        metadata: { reason: "test" },
        createdAt: "2026-09-18T00:00:01.000Z",
      }],
    });

    expect(result).toEqual({ nodeCount: 1, edgeCount: 0, hypothesisCount: 0, eventCount: 1 });
    expect(rpc).toHaveBeenCalledWith("persist_phase11_graph_state", expect.objectContaining({
      target_workspace_id: "workspace-1",
      target_run_id: "run-1",
      target_authorization_snapshot_ref: "authz-snapshot-1",
      node_rows: [expect.objectContaining({
        node_id: "node-1",
        canonical_locator: "https://secret.example/internal",
        authorization_ref: "authz-snapshot-1",
        provenance_refs: ["evidence-1"],
      })],
    }));
  });

  it("returns a generic error without leaking database details", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "private table detail sentinel" } }));
    await expect(persistPentestGraphState({ rpc } as Phase11RpcClient, {
      workspaceId: "workspace-1",
      runId: "run-1",
      authorizationSnapshotRef: "authz-snapshot-1",
      graph,
      hypotheses: [],
      coverage,
    })).rejects.toThrow("Unable to persist Phase 11 graph state.");
  });

  it("reads only privacy-reduced node/edge summary columns with hard bounds", async () => {
    const nodeLimit = vi.fn(async () => ({ data: [], error: null }));
    const edgeLimit = vi.fn(async () => ({ data: [], error: null }));
    function query(limit: ReturnType<typeof vi.fn>) {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit,
      };
    }
    const nodeQuery = query(nodeLimit);
    const edgeQuery = query(edgeLimit);
    const client = {
      from: vi.fn((table: string) => table === "pentest_graph_node_summaries" ? nodeQuery : edgeQuery),
    } as unknown as Phase11ReadClient;

    await listPentestGraphNodes(client, "workspace-1", "run-1", 5000);
    await listPentestGraphEdges(client, "workspace-1", "run-1", 5000);

    expect(nodeQuery.select).toHaveBeenCalledWith(
      "workspace_id,run_id,node_id,asset_type,parent_node_ids,technology_tags,confidence,updated_at",
    );
    expect(edgeQuery.select).toHaveBeenCalledWith(
      "workspace_id,run_id,edge_id,from_node_id,to_node_id,relationship,confidence,stale,updated_at",
    );
    expect(nodeLimit).toHaveBeenCalledWith(500);
    expect(edgeLimit).toHaveBeenCalledWith(500);
  });
});
