import { describe, expect, it } from "vitest";
import {
  PlatformAdminStatsError,
  getPlatformStats,
  type PlatformAdminStatsDependencies,
} from "@/lib/platform-admin/stats";

function dependencies(overrides: Partial<PlatformAdminStatsDependencies> = {}): PlatformAdminStatsDependencies {
  return {
    authorize: async () => undefined,
    loadCounts: async () => ({
      totalUsers: 42,
      newUsers7d: 7,
      newUsers30d: 19,
      totalWorkspaces: 48,
      totalAssets: 120,
      verifiedAssets: 93,
      totalScans: 805,
      scans24h: 31,
      totalFindings: 240,
      activeFindings: 65,
      criticalFindings: 4,
    }),
    ...overrides,
  };
}

describe("platform admin statistics", () => {
  it("returns normalized aggregate metrics with an observation timestamp", async () => {
    const now = new Date("2026-09-10T02:00:00.000Z");
    const stats = await getPlatformStats(dependencies(), now);

    expect(stats).toEqual({
      totalUsers: 42,
      newUsers7d: 7,
      newUsers30d: 19,
      totalWorkspaces: 48,
      totalAssets: 120,
      verifiedAssets: 93,
      totalScans: 805,
      scans24h: 31,
      totalFindings: 240,
      activeFindings: 65,
      criticalFindings: 4,
      observedAt: "2026-09-10T02:00:00.000Z",
    });
  });

  it("normalizes invalid negative counts to zero", async () => {
    const stats = await getPlatformStats(
      dependencies({
        loadCounts: async () => ({
          totalUsers: -1,
          newUsers7d: Number.NaN,
          newUsers30d: 2,
          totalWorkspaces: 1,
          totalAssets: 1,
          verifiedAssets: 1,
          totalScans: 1,
          scans24h: 1,
          totalFindings: 1,
          activeFindings: 1,
          criticalFindings: 0,
        }),
      }),
      new Date("2026-09-10T02:00:00.000Z"),
    );

    expect(stats.totalUsers).toBe(0);
    expect(stats.newUsers7d).toBe(0);
  });

  it("sanitizes aggregate provider failures", async () => {
    await expect(
      getPlatformStats(dependencies({ loadCounts: async () => { throw new Error("database internals"); } })),
    ).rejects.toEqual(
      expect.objectContaining<Partial<PlatformAdminStatsError>>({
        code: "PLATFORM_ADMIN_STATS_FAILED",
        message: "Unable to load platform statistics.",
      }),
    );
  });
});
