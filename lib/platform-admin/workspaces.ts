import type { ScanJobStatus } from "@/lib/database.types";
import type { Phase10cDatabase } from "@/lib/database.phase10c.types";
import { requirePlatformAdmin } from "@/lib/platform-admin/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_WORKSPACE_SCAN = 250;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_QUERY_LENGTH = 120;
const ACTIVE_FINDING_STATES = new Set(["open", "acknowledged", "in_progress", "resolved", "retest_pending"]);

export interface AdminWorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  createdByUserId: string;
  creatorDisplayName: string | null;
  createdAt: string;
  memberCount: number;
  assetCount: number;
  scanCounts: Record<ScanJobStatus, number> & { total: number };
  activeFindingCount: number;
  criticalFindingCount: number;
  recentActivityAt: string | null;
}

export interface AdminWorkspaceListResult {
  workspaces: AdminWorkspaceSummary[];
  page: number;
  perPage: number;
  hasNextPage: boolean;
  searchTruncated: boolean;
}

export class PlatformAdminWorkspaceReadError extends Error {
  readonly code = "PLATFORM_ADMIN_WORKSPACE_READ_FAILED" as const;

  constructor() {
    super("Unable to load platform workspace activity.");
    this.name = "PlatformAdminWorkspaceReadError";
  }
}

function positiveInteger(value: number | undefined, fallback: number, maximum: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(1, Math.floor(value)));
}

function scanCounts(): AdminWorkspaceSummary["scanCounts"] {
  return {
    total: 0,
    queued: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    blocked: 0,
    cancelled: 0,
  };
}

function newestTimestamp(current: string | null, candidate: string | null | undefined): string | null {
  if (!candidate) return current;
  if (!current) return candidate;
  return Date.parse(candidate) > Date.parse(current) ? candidate : current;
}

export async function listAdminWorkspaces(input: {
  page?: number;
  perPage?: number;
  query?: string;
} = {}): Promise<AdminWorkspaceListResult> {
  await requirePlatformAdmin();
  const admin = createAdminClient<Phase10cDatabase>();
  const page = positiveInteger(input.page, 1, Number.MAX_SAFE_INTEGER);
  const perPage = positiveInteger(input.perPage, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const query = (input.query ?? "").trim().slice(0, MAX_QUERY_LENGTH).toLocaleLowerCase();

  try {
    const { data: workspaceRows, error: workspaceError } = await admin
      .from("workspaces")
      .select("id,name,slug,created_by,created_at")
      .order("created_at", { ascending: false })
      .limit(MAX_WORKSPACE_SCAN);
    if (workspaceError) throw new Error("WORKSPACE_LIST_FAILED");

    const allRows = workspaceRows ?? [];
    const filtered = query
      ? allRows.filter((row) => [row.id, row.name, row.slug, row.created_by]
          .some((value) => value.toLocaleLowerCase().includes(query)))
      : allRows;
    const start = (page - 1) * perPage;
    const selected = filtered.slice(start, start + perPage);
    const workspaceIds = selected.map((row) => row.id);

    if (workspaceIds.length === 0) {
      return {
        workspaces: [],
        page,
        perPage,
        hasNextPage: false,
        searchTruncated: allRows.length === MAX_WORKSPACE_SCAN,
      };
    }

    const creatorIds = [...new Set(selected.map((row) => row.created_by))];
    const [memberships, assets, scans, findings, profiles] = await Promise.all([
      admin.from("workspace_members").select("workspace_id,user_id").in("workspace_id", workspaceIds),
      admin.from("assets").select("workspace_id,id").in("workspace_id", workspaceIds),
      admin.from("scan_jobs").select("workspace_id,status,created_at").in("workspace_id", workspaceIds),
      admin.from("security_findings").select("workspace_id,severity,lifecycle_state,last_seen_at").in("workspace_id", workspaceIds),
      admin.from("profiles").select("id,display_name").in("id", creatorIds),
    ]);

    if (memberships.error || assets.error || scans.error || findings.error || profiles.error) {
      throw new Error("WORKSPACE_ACTIVITY_LOOKUP_FAILED");
    }

    const profileById = new Map((profiles.data ?? []).map((profile) => [profile.id, profile.display_name]));
    const summaries = new Map<string, AdminWorkspaceSummary>();
    for (const row of selected) {
      summaries.set(row.id, {
        id: row.id,
        name: row.name,
        slug: row.slug,
        createdByUserId: row.created_by,
        creatorDisplayName: profileById.get(row.created_by) ?? null,
        createdAt: row.created_at,
        memberCount: 0,
        assetCount: 0,
        scanCounts: scanCounts(),
        activeFindingCount: 0,
        criticalFindingCount: 0,
        recentActivityAt: row.created_at,
      });
    }

    for (const membership of memberships.data ?? []) {
      const summary = summaries.get(membership.workspace_id);
      if (summary) summary.memberCount += 1;
    }
    for (const asset of assets.data ?? []) {
      const summary = summaries.get(asset.workspace_id);
      if (summary) summary.assetCount += 1;
    }
    for (const scan of scans.data ?? []) {
      const summary = summaries.get(scan.workspace_id);
      if (!summary) continue;
      summary.scanCounts.total += 1;
      summary.scanCounts[scan.status] += 1;
      summary.recentActivityAt = newestTimestamp(summary.recentActivityAt, scan.created_at);
    }
    for (const finding of findings.data ?? []) {
      const summary = summaries.get(finding.workspace_id);
      if (!summary) continue;
      if (ACTIVE_FINDING_STATES.has(finding.lifecycle_state)) {
        summary.activeFindingCount += 1;
        if (finding.severity === "critical") summary.criticalFindingCount += 1;
      }
      summary.recentActivityAt = newestTimestamp(summary.recentActivityAt, finding.last_seen_at);
    }

    const searchTruncated = allRows.length === MAX_WORKSPACE_SCAN;
    return {
      workspaces: selected.flatMap((row) => {
        const summary = summaries.get(row.id);
        return summary ? [summary] : [];
      }),
      page,
      perPage,
      hasNextPage: filtered.length > start + perPage || searchTruncated,
      searchTruncated,
    };
  } catch {
    throw new PlatformAdminWorkspaceReadError();
  }
}
