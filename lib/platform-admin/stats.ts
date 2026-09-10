import type { Phase10cDatabase } from "@/lib/database.phase10c.types";
import { requirePlatformAdmin } from "@/lib/platform-admin/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_FINDING_STATES = ["open", "acknowledged", "in_progress", "resolved", "retest_pending"] as const;

export interface PlatformStatsCounts {
  totalUsers: number;
  newUsers7d: number;
  newUsers30d: number;
  totalWorkspaces: number;
  totalAssets: number;
  verifiedAssets: number;
  totalScans: number;
  scans24h: number;
  totalFindings: number;
  activeFindings: number;
  criticalFindings: number;
}

export interface PlatformStats extends PlatformStatsCounts {
  observedAt: string;
}

export interface PlatformAdminStatsDependencies {
  authorize(): Promise<void>;
  loadCounts(now: Date): Promise<PlatformStatsCounts>;
}

export class PlatformAdminStatsError extends Error {
  readonly code = "PLATFORM_ADMIN_STATS_FAILED" as const;

  constructor(message = "Unable to load platform statistics.") {
    super(message);
    this.name = "PlatformAdminStatsError";
  }
}

function safeCount(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function readCount(result: { count: number | null; error: unknown }): number {
  if (result.error) throw new Error("PLATFORM_COUNT_QUERY_FAILED");
  return result.count ?? 0;
}

function createDefaultDependencies(): PlatformAdminStatsDependencies {
  const admin = createAdminClient<Phase10cDatabase>();

  return {
    authorize: async () => {
      await requirePlatformAdmin();
    },
    loadCounts: async (now) => {
      const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS).toISOString();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS).toISOString();
      const oneDayAgo = new Date(now.getTime() - DAY_MS).toISOString();

      const [
        totalUsers,
        newUsers7d,
        newUsers30d,
        totalWorkspaces,
        totalAssets,
        verifiedAssets,
        totalScans,
        scans24h,
        totalFindings,
        activeFindings,
        criticalFindings,
      ] = await Promise.all([
        admin.from("profiles").select("id", { count: "exact", head: true }),
        admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
        admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
        admin.from("workspaces").select("id", { count: "exact", head: true }),
        admin.from("assets").select("id", { count: "exact", head: true }),
        admin.from("assets").select("id", { count: "exact", head: true }).eq("verification_status", "verified"),
        admin.from("scan_jobs").select("id", { count: "exact", head: true }),
        admin.from("scan_jobs").select("id", { count: "exact", head: true }).gte("created_at", oneDayAgo),
        admin.from("security_findings").select("finding_id", { count: "exact", head: true }),
        admin.from("security_findings").select("finding_id", { count: "exact", head: true }).in("lifecycle_state", [...ACTIVE_FINDING_STATES]),
        admin.from("security_findings").select("finding_id", { count: "exact", head: true }).eq("severity", "critical").in("lifecycle_state", [...ACTIVE_FINDING_STATES]),
      ]);

      return {
        totalUsers: readCount(totalUsers),
        newUsers7d: readCount(newUsers7d),
        newUsers30d: readCount(newUsers30d),
        totalWorkspaces: readCount(totalWorkspaces),
        totalAssets: readCount(totalAssets),
        verifiedAssets: readCount(verifiedAssets),
        totalScans: readCount(totalScans),
        scans24h: readCount(scans24h),
        totalFindings: readCount(totalFindings),
        activeFindings: readCount(activeFindings),
        criticalFindings: readCount(criticalFindings),
      };
    },
  };
}

export async function getPlatformStats(
  dependencies?: PlatformAdminStatsDependencies,
  now = new Date(),
): Promise<PlatformStats> {
  const deps = dependencies ?? createDefaultDependencies();
  await deps.authorize();

  try {
    const counts = await deps.loadCounts(now);
    return {
      totalUsers: safeCount(counts.totalUsers),
      newUsers7d: safeCount(counts.newUsers7d),
      newUsers30d: safeCount(counts.newUsers30d),
      totalWorkspaces: safeCount(counts.totalWorkspaces),
      totalAssets: safeCount(counts.totalAssets),
      verifiedAssets: safeCount(counts.verifiedAssets),
      totalScans: safeCount(counts.totalScans),
      scans24h: safeCount(counts.scans24h),
      totalFindings: safeCount(counts.totalFindings),
      activeFindings: safeCount(counts.activeFindings),
      criticalFindings: safeCount(counts.criticalFindings),
      observedAt: now.toISOString(),
    };
  } catch {
    throw new PlatformAdminStatsError();
  }
}
