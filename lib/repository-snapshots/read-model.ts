import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export interface RepositorySnapshotHistoryItem {
  id: string;
  scanJobId: string;
  defaultBranch: string;
  resolvedCommitSha: string;
  retainedFileCount: number;
  retainedBytes: number;
  storedArtifactBytes: number;
  createdAt: string;
  expiresAt: string;
}

type SnapshotRow = {
  id: string;
  scan_job_id: string;
  default_branch: string;
  resolved_commit_sha: string;
  retained_file_count: number;
  retained_bytes: number;
  stored_artifact_bytes: number;
  created_at: string;
  expires_at: string;
};

type SnapshotQuery = {
  eq(column: string, value: string): SnapshotQuery;
  order(column: string, options: { ascending: boolean }): SnapshotQuery;
  limit(count: number): PromiseLike<{ data: SnapshotRow[] | null; error: { message: string } | null }>;
};

type SnapshotReadClient = {
  from(table: "repository_source_snapshots"): {
    select(columns: string): SnapshotQuery;
  };
};

export async function listRepositorySnapshots(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  assetId: string,
  limit = 20,
): Promise<readonly RepositorySnapshotHistoryItem[]> {
  const boundedLimit = Math.max(1, Math.min(20, Math.trunc(limit)));
  const client = supabase as unknown as SnapshotReadClient;
  const { data, error } = await client
    .from("repository_source_snapshots")
    .select("id,scan_job_id,default_branch,resolved_commit_sha,retained_file_count,retained_bytes,stored_artifact_bytes,created_at,expires_at")
    .eq("workspace_id", workspaceId)
    .eq("asset_id", assetId)
    .order("created_at", { ascending: false })
    .limit(boundedLimit);
  if (error) throw new Error(error.message);

  return Object.freeze((data ?? []).map((row) => Object.freeze({
    id: row.id,
    scanJobId: row.scan_job_id,
    defaultBranch: row.default_branch,
    resolvedCommitSha: row.resolved_commit_sha,
    retainedFileCount: row.retained_file_count,
    retainedBytes: row.retained_bytes,
    storedArtifactBytes: row.stored_artifact_bytes,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  })));
}
