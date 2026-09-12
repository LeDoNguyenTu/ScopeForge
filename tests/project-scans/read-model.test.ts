import { describe, expect, it, vi } from "vitest";
import { loadConnectedProjectScanReadModel } from "@/lib/project-scans/read-model";

function fakeClient(result: { data: unknown; error: { message: string } | null }) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result);
  return { from: vi.fn(() => builder) } as never;
}

describe("connected project scan read model", () => {
  it("returns only safe repository and orchestration state", async () => {
    const client = fakeClient({
      data: {
        full_name: "scopeforge-labs/app",
        default_branch: "main",
        is_private: false,
        access_status: "active",
        project_scan_state: "snapshot_queued",
        repository_id: 9001,
        github_connection_id: "secret-ish-internal-id",
      },
      error: null,
    });

    await expect(loadConnectedProjectScanReadModel(client, "workspace-1", "asset-1")).resolves.toEqual({
      fullName: "scopeforge-labs/app",
      defaultBranch: "main",
      isPrivate: false,
      accessStatus: "active",
      projectScanState: "snapshot_queued",
    });
  });

  it("fails closed when the Phase 10A1 table is not deployed or cannot be read", async () => {
    const client = fakeClient({ data: null, error: { message: "relation does not exist" } });
    await expect(loadConnectedProjectScanReadModel(client, "workspace-1", "asset-1")).resolves.toBeNull();
  });

  it("rejects malformed provider metadata instead of leaking partial state", async () => {
    const client = fakeClient({
      data: {
        full_name: "scopeforge-labs/app",
        default_branch: "main",
        is_private: false,
        access_status: "active",
        project_scan_state: "unexpected_state",
      },
      error: null,
    });
    await expect(loadConnectedProjectScanReadModel(client, "workspace-1", "asset-1")).resolves.toBeNull();
  });
});
