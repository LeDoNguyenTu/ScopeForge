import { describe, expect, it, vi } from "vitest";
import {
  listPentestObservationSummaries,
  persistPentestObservations,
} from "@/lib/pentest-observations/persistence";
import type { Phase11ReadClient, Phase11RpcClient } from "@/lib/database.phase11.types";
import type { Observation } from "@/packages/security-planning";

const observation: Observation = {
  observationId: "observation-1",
  runId: "run-1",
  providerId: "scopeforge.runtime-observer",
  providerVersion: "0.1",
  capabilityId: "web.runtime.observe.v1",
  assetNodeIds: ["node-1"],
  evidenceRefs: ["secret-evidence-ref"],
  facts: { kind: "http-status", status: 200 },
  observedAt: "2026-09-18T00:00:00.000Z",
  confidence: 0.9,
  authorizationSnapshotRef: "authz-snapshot-1",
  executionMode: "passive",
};

describe("Phase 11 observation persistence service", () => {
  it("passes canonical evidence/facts only to the trusted RPC", async () => {
    const rpc = vi.fn(async () => ({
      data: { insertedCount: 1, replayedCount: 0 },
      error: null,
    }));

    await expect(persistPentestObservations({ rpc } as Phase11RpcClient, {
      workspaceId: "workspace-1",
      runId: "run-1",
      authorizationSnapshotRef: "authz-snapshot-1",
      observations: [observation],
    })).resolves.toEqual({ insertedCount: 1, replayedCount: 0 });

    expect(rpc).toHaveBeenCalledWith("persist_phase11_observations", expect.objectContaining({
      target_workspace_id: "workspace-1",
      target_run_id: "run-1",
      observation_rows: [expect.objectContaining({
        observation_id: "observation-1",
        evidence_refs: ["secret-evidence-ref"],
        facts: { kind: "http-status", status: 200 },
        authorization_snapshot_ref: "authz-snapshot-1",
      })],
    }));
  });

  it("uses privacy-reduced summary reads that cannot return facts or evidence refs", async () => {
    const limit = vi.fn(async () => ({ data: [], error: null }));
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit,
    };
    const client = { from: vi.fn(() => query) } as unknown as Phase11ReadClient;

    await listPentestObservationSummaries(client, "workspace-1", "run-1", 5000);

    const selection = query.select.mock.calls[0][0] as string;
    expect(selection).not.toContain("facts");
    expect(selection).not.toContain("evidence_refs");
    expect(selection).not.toContain("authorization_snapshot_ref");
    expect(limit).toHaveBeenCalledWith(500);
  });

  it("returns generic persistence/read failures", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "secret db detail" } }));
    await expect(persistPentestObservations({ rpc } as Phase11RpcClient, {
      workspaceId: "workspace-1",
      runId: "run-1",
      authorizationSnapshotRef: "authz-snapshot-1",
      observations: [observation],
    })).rejects.toThrow("Unable to persist Phase 11 observations.");
  });
});
