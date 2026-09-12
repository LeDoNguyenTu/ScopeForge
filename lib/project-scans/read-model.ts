import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type {
  GitHubProjectScanState,
  GitHubRepositoryAccessStatus,
} from "@/lib/database.phase10a1.types";

export interface ConnectedProjectScanReadModel {
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  accessStatus: GitHubRepositoryAccessStatus;
  projectScanState: GitHubProjectScanState;
  autoScanEnabled: boolean;
}

type QueryResult = PromiseLike<{ data: unknown; error: { message: string } | null }>;
type QueryBuilder = {
  select(columns: string): QueryBuilder;
  eq(column: string, value: string): QueryBuilder;
  maybeSingle(): QueryResult;
};
type UntypedReadClient = { from(table: string): QueryBuilder };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isAccessStatus(value: unknown): value is GitHubRepositoryAccessStatus {
  return value === "active" || value === "inaccessible" || value === "removed";
}

function isProjectScanState(value: unknown): value is GitHubProjectScanState {
  return value === "idle"
    || value === "snapshot_queued"
    || value === "waiting_scan_runtime"
    || value === "scan_queued"
    || value === "retry_pending";
}

export async function loadConnectedProjectScanReadModel(
  client: SupabaseClient<Database>,
  workspaceId: string,
  assetId: string,
): Promise<ConnectedProjectScanReadModel | null> {
  const untyped = client as unknown as UntypedReadClient;
  const { data, error } = await untyped
    .from("github_repository_links")
    .select("full_name,default_branch,is_private,access_status,project_scan_state,auto_scan_enabled")
    .eq("workspace_id", workspaceId)
    .eq("asset_id", assetId)
    .maybeSingle();

  // Phase 10A1 may be deployed after the web bundle. Missing/unreadable connection
  // state therefore fails closed and leaves the existing repository controls intact.
  if (error || data === null) return null;

  const row = record(data);
  const fullName = nonEmptyString(row?.full_name);
  const defaultBranch = nonEmptyString(row?.default_branch);
  const isPrivate = row?.is_private;
  const accessStatus = row?.access_status;
  const projectScanState = row?.project_scan_state;
  const autoScanEnabled = row?.auto_scan_enabled;

  if (
    !fullName
    || !defaultBranch
    || typeof isPrivate !== "boolean"
    || !isAccessStatus(accessStatus)
    || !isProjectScanState(projectScanState)
    || typeof autoScanEnabled !== "boolean"
  ) return null;

  return Object.freeze({
    fullName,
    defaultBranch,
    isPrivate,
    accessStatus,
    projectScanState,
    autoScanEnabled,
  });
}
