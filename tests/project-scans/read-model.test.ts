import { describe, expect, it, vi } from "vitest";
import { loadConnectedProjectScanReadModel } from "@/lib/project-scans/read-model";

function fakeClient(result: { data: unknown; error: { message: string } | null }) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result);
  const from = vi.fn(() => builder);
  return {
    client: { from } as never,
    from,
    select: builder.select as ReturnType<typeof vi.fn>,
  };
}

describe("connected project scan read model", () => {
  it("returns only safe repository and orchestration state including automatic scanning truth", async () => {
    const fake = fakeClient({
      data: {
        full_name: "scopeforge-labs/app",
        default_branch: "main",
        is_private: false,
        access_status: "active",
        project_scan_state: "snapshot_queued",
        auto_scan_enabled: true,
        repository_id: 9001,
        github_connection_id: "secret-ish-internal-id",
      },
      error: null,
    });

    await expect(loadConnectedProjectScanReadModel(fake.client, "workspace-1", "asset-1")).resolves.toEqual({
      fullName: "scopeforge-labs/app",
      defaultBranch: "main",
      isPrivate: false,
      accessStatus: "active",
      projectScanState: "snapshot_queued",
      autoScanEnabled: true,
    });
    expect(fake.from).toHaveBeenCalledTimes(1);
    expect(fake.from).toHaveBeenCalledWith("github_repository_links");
    expect(fake.select).toHaveBeenCalledWith(
      "full_name,default_branch,is_private,access_status,project_scan_state,auto_scan_enabled",
    );
  });

  it("reports automatic scanning disabled without exposing private webhook state", async () => {
    const fake = fakeClient({
      data: {
        full_name: "scopeforge-labs/app",
        default_branch: "main",
        is_private: false,
        access_status: "active",
        project_scan_state: "idle",
        auto_scan_enabled: false,
      },
      error: null,
    });

    await expect(loadConnectedProjectScanReadModel(fake.client, "workspace-1", "asset-1")).resolves.toMatchObject({
      autoScanEnabled: false,
      accessStatus: "active",
      projectScanState: "idle",
    });
    expect(fake.from).not.toHaveBeenCalledWith("github_webhook_deliveries");
    expect(fake.from).not.toHaveBeenCalledWith("github_repository_auto_scan_state");
  });

  it("fails closed when the Phase 10A1 table is not deployed or cannot be read", async () => {
    const fake = fakeClient({ data: null, error: { message: "relation does not exist" } });
    await expect(loadConnectedProjectScanReadModel(fake.client, "workspace-1", "asset-1")).resolves.toBeNull();
  });

  it("rejects malformed provider metadata instead of leaking partial state", async () => {
    const fake = fakeClient({
      data: {
        full_name: "scopeforge-labs/app",
        default_branch: "main",
        is_private: false,
        access_status: "active",
        project_scan_state: "unexpected_state",
        auto_scan_enabled: true,
      },
      error: null,
    });
    await expect(loadConnectedProjectScanReadModel(fake.client, "workspace-1", "asset-1")).resolves.toBeNull();
  });

  it("rejects malformed automatic scanning state instead of inventing browser truth", async () => {
    const fake = fakeClient({
      data: {
        full_name: "scopeforge-labs/app",
        default_branch: "main",
        is_private: false,
        access_status: "active",
        project_scan_state: "idle",
        auto_scan_enabled: "yes",
      },
      error: null,
    });
    await expect(loadConnectedProjectScanReadModel(fake.client, "workspace-1", "asset-1")).resolves.toBeNull();
  });
});
