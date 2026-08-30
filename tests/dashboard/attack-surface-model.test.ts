import { describe, expect, it } from "vitest";
import { buildAttackSurfaceModel } from "@/lib/dashboard/attack-surface-model";

const asset = (overrides: Partial<{
  id: string;
  kind: "web_application" | "api" | "repository";
  name: string;
  canonical_target: string;
  verification_status: "unverified" | "pending" | "verified" | "failed";
  created_at: string;
}> = {}) => ({
  id: "asset-a",
  kind: "web_application" as const,
  name: "Customer portal",
  canonical_target: "https://example.com",
  verification_status: "verified" as const,
  created_at: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

const finding = (overrides: Partial<{
  asset_id: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  lifecycle_state: "open" | "acknowledged" | "in_progress" | "resolved" | "retest_pending";
}> = {}) => ({
  asset_id: "asset-a",
  severity: "high" as const,
  title: "Risky configuration",
  lifecycle_state: "open" as const,
  ...overrides,
});

describe("buildAttackSurfaceModel", () => {
  it("classifies verified, pending, and finding-linked assets from real state", () => {
    const model = buildAttackSurfaceModel({
      assets: [
        asset({ id: "healthy", name: "Healthy", verification_status: "verified" }),
        asset({ id: "pending", name: "Pending", verification_status: "pending", created_at: "2026-08-02T00:00:00.000Z" }),
        asset({ id: "risk", name: "Risk", verification_status: "verified", created_at: "2026-08-03T00:00:00.000Z" }),
      ],
      findings: [finding({ asset_id: "risk", severity: "medium" })],
    });

    expect(model.nodes.find((node) => node.id === "healthy")?.state).toBe("healthy");
    expect(model.nodes.find((node) => node.id === "pending")?.state).toBe("pending");
    expect(model.nodes.find((node) => node.id === "risk")?.state).toBe("risk");
    expect(model.metrics).toEqual({
      registeredAssets: 3,
      verifiedAssets: 2,
      openFindings: 1,
      verificationPercent: 67,
      affectedAssets: 1,
    });
  });

  it("uses the highest real severity and title for the priority asset", () => {
    const model = buildAttackSurfaceModel({
      assets: [asset()],
      findings: [
        finding({ severity: "low", title: "Low finding" }),
        finding({ severity: "critical", title: "Critical finding" }),
        finding({ severity: "high", title: "High finding" }),
      ],
    });

    expect(model.nodes[0]?.severity).toBe("critical");
    expect(model.nodes[0]?.findingCount).toBe(3);
    expect(model.priority).toEqual({
      assetId: "asset-a",
      assetName: "Customer portal",
      severity: "critical",
      title: "Critical finding",
    });
  });

  it("keeps node placement deterministic regardless of input order", () => {
    const first = asset({ id: "a", name: "A", created_at: "2026-08-01T00:00:00.000Z" });
    const second = asset({ id: "b", name: "B", created_at: "2026-08-02T00:00:00.000Z" });

    const forward = buildAttackSurfaceModel({ assets: [first, second], findings: [] });
    const reverse = buildAttackSurfaceModel({ assets: [second, first], findings: [] });

    expect(reverse.nodes).toEqual(forward.nodes);
  });

  it("caps visual topology nodes at ten while preserving aggregate metrics", () => {
    const assets = Array.from({ length: 12 }, (_, index) => asset({
      id: `asset-${index}`,
      name: `Asset ${index}`,
      created_at: `2026-08-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
    }));

    const model = buildAttackSurfaceModel({ assets, findings: [] });
    expect(model.nodes).toHaveLength(10);
    expect(model.metrics.registeredAssets).toBe(12);
  });

  it("returns a truthful empty model", () => {
    const model = buildAttackSurfaceModel({ assets: [], findings: [] });
    expect(model.nodes).toEqual([]);
    expect(model.priority).toBeNull();
    expect(model.metrics).toEqual({
      registeredAssets: 0,
      verifiedAssets: 0,
      openFindings: 0,
      verificationPercent: 0,
      affectedAssets: 0,
    });
  });
});
