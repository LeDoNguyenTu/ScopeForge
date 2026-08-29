import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export interface RepositoryScanHistoryItem {
  id: string;
  snapshotId: string;
  scanJobId: string;
  scannerProfileId: "phase3-hosted-static-v1";
  scannerProfileVersion: 1;
  toolVersion: string;
  resolvedCommitSha: string;
  runRef: string;
  scanStartedAt: string;
  scanDurationMs: number;
  filesAnalyzed: number;
  filesSkipped: number;
  totalBytes: number;
  findingCount: number;
  resultDigest: string;
  createdAt: string;
}

export interface RepositoryScanJobSummary {
  id: string;
  status: string;
  failureCode: string | null;
  cancelRequestedAt: string | null;
  findingCount: number;
  createdAt: string;
}

export interface RepositoryScanReadModel {
  latestJob: RepositoryScanJobSummary | null;
  history: readonly RepositoryScanHistoryItem[];
}

type QueryResult = PromiseLike<{ data: unknown; error: { message: string } | null }>;
type QueryBuilder = {
  select(columns: string): QueryBuilder;
  eq(column: string, value: string): QueryBuilder;
  order(column: string, options: { ascending: boolean }): QueryBuilder;
  limit(value: number): QueryBuilder & QueryResult;
  maybeSingle(): QueryResult;
};
type UntypedReadClient = { from(table: string): QueryBuilder };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function integerValue(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : null;
}

function parseRun(value: unknown): RepositoryScanHistoryItem | null {
  const row = record(value);
  if (!row) return null;
  const scannerProfileVersion = integerValue(row.scanner_profile_version);
  const scanDurationMs = integerValue(row.scan_duration_ms);
  const filesAnalyzed = integerValue(row.files_analyzed);
  const filesSkipped = integerValue(row.files_skipped);
  const totalBytes = integerValue(row.total_bytes);
  const findingCount = integerValue(row.finding_count);
  const id = stringValue(row.id);
  const snapshotId = stringValue(row.snapshot_id);
  const scanJobId = stringValue(row.scan_job_id);
  const toolVersion = stringValue(row.tool_version);
  const resolvedCommitSha = stringValue(row.resolved_commit_sha);
  const runRef = stringValue(row.run_ref);
  const scanStartedAt = stringValue(row.scan_started_at);
  const resultDigest = stringValue(row.result_digest);
  const createdAt = stringValue(row.created_at);
  if (
    !id || !snapshotId || !scanJobId || !toolVersion || !resolvedCommitSha || !runRef
    || !scanStartedAt || !resultDigest || !createdAt
    || row.scanner_profile_id !== "phase3-hosted-static-v1"
    || scannerProfileVersion !== 1
    || scanDurationMs === null || filesAnalyzed === null || filesSkipped === null
    || totalBytes === null || findingCount === null
  ) return null;

  return Object.freeze({
    id,
    snapshotId,
    scanJobId,
    scannerProfileId: "phase3-hosted-static-v1" as const,
    scannerProfileVersion: 1 as const,
    toolVersion,
    resolvedCommitSha,
    runRef,
    scanStartedAt,
    scanDurationMs,
    filesAnalyzed,
    filesSkipped,
    totalBytes,
    findingCount,
    resultDigest,
    createdAt,
  });
}

function parseJob(value: unknown): RepositoryScanJobSummary | null {
  const row = record(value);
  if (!row) return null;
  const id = stringValue(row.id);
  const status = stringValue(row.status);
  const createdAt = stringValue(row.created_at);
  const findingCount = integerValue(row.finding_count);
  if (!id || !status || !createdAt || findingCount === null) return null;
  return Object.freeze({
    id,
    status,
    failureCode: row.failure_code === null ? null : stringValue(row.failure_code),
    cancelRequestedAt: row.cancel_requested_at === null ? null : stringValue(row.cancel_requested_at),
    findingCount,
    createdAt,
  });
}

function boundedLimit(value: number): number {
  if (!Number.isFinite(value)) return 10;
  return Math.max(1, Math.min(20, Math.trunc(value)));
}

export async function loadRepositoryScanReadModel(
  client: SupabaseClient<Database>,
  workspaceId: string,
  assetId: string,
  requestedLimit = 10,
): Promise<RepositoryScanReadModel> {
  const untyped = client as unknown as UntypedReadClient;
  const [jobsResult, runsResult] = await Promise.all([
    untyped
      .from("scan_jobs")
      .select("id,status,failure_code,cancel_requested_at,finding_count,created_at")
      .eq("workspace_id", workspaceId)
      .eq("asset_id", assetId)
      .eq("job_kind", "repository_scan")
      .order("created_at", { ascending: false })
      .limit(1),
    untyped
      .from("repository_scan_runs")
      .select("id,snapshot_id,scan_job_id,scanner_profile_id,scanner_profile_version,tool_version,resolved_commit_sha,run_ref,scan_started_at,scan_duration_ms,files_analyzed,files_skipped,total_bytes,finding_count,result_digest,created_at")
      .eq("workspace_id", workspaceId)
      .eq("asset_id", assetId)
      .order("created_at", { ascending: false })
      .limit(boundedLimit(requestedLimit)),
  ]);

  if (jobsResult.error) throw new Error("Unable to load hosted repository scan status.");
  if (runsResult.error) throw new Error("Unable to load hosted repository scan history.");

  const jobs = Array.isArray(jobsResult.data) ? jobsResult.data : [];
  const runs = Array.isArray(runsResult.data) ? runsResult.data : [];
  return Object.freeze({
    latestJob: jobs.length === 0 ? null : parseJob(jobs[0]),
    history: Object.freeze(runs.map(parseRun).filter((item): item is RepositoryScanHistoryItem => item !== null)),
  });
}
