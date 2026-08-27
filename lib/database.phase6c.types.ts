import type { Database as BaseDatabase, Json } from "./database.types";

type Phase6cFunctions = {
  register_repository_scan_worker_node: {
    Args: { target_credential_hash: string; target_software_version: string };
    Returns: Json;
  };
  enqueue_repository_scan_worker_task: {
    Args: { target_workspace_id: string; target_asset_id: string; target_actor_id: string };
    Returns: Json;
  };
  claim_repository_scan_worker_task: {
    Args: { target_worker_id: string };
    Returns: Json;
  };
  get_repository_scan_snapshot_artifact: {
    Args: { target_worker_id: string; target_task_id: string; target_attempt_id: string; target_lease_token: string };
    Returns: Json;
  };
  finalize_repository_scan_worker_failure: {
    Args: {
      target_worker_id: string;
      target_task_id: string;
      target_attempt_id: string;
      target_lease_token: string;
      target_terminal_outcome: string;
      target_failure_code: string | null;
      target_terminal_payload_digest: string;
      target_wall_time_ms: number;
      target_cpu_time_ms: number;
      target_peak_memory_bytes: number;
      target_input_bytes: number;
      target_output_bytes: number;
    };
    Returns: Json;
  };
  get_repository_scan_publication_context: {
    Args: { target_worker_id: string; target_task_id: string; target_attempt_id: string; target_lease_token: string };
    Returns: Json;
  };
  finalize_repository_scan_success: {
    Args: {
      target_worker_id: string;
      target_task_id: string;
      target_attempt_id: string;
      target_lease_token: string;
      target_snapshot_id: string;
      target_repository_canonical_url: string;
      target_resolved_commit_sha: string;
      target_snapshot_content_digest: string;
      target_snapshot_artifact_digest: string;
      target_scanner_profile_id: string;
      target_scanner_profile_version: number;
      target_terminal_payload_digest: string;
      target_result_digest: string;
      target_run_ref: string;
      target_tool_version: string;
      target_scan_started_at: string;
      target_scan_duration_ms: number;
      target_scanner_descriptors: Json;
      target_scanner_error_count: number;
      target_files_analyzed: number;
      target_files_skipped: number;
      target_total_bytes: number;
      target_wall_time_ms: number;
      target_cpu_time_ms: number;
      target_peak_memory_bytes: number;
      target_input_bytes: number;
      target_output_bytes: number;
      finding_rows: Json;
      evidence_rows: Json;
    };
    Returns: Json;
  };
};

type RepositoryScanRunTable = {
  Row: {
    id: string;
    workspace_id: string;
    asset_id: string;
    snapshot_id: string;
    scan_job_id: string;
    requested_by: string;
    schema_version: number;
    scanner_profile_id: string;
    scanner_profile_version: number;
    tool_version: string;
    resolved_commit_sha: string;
    snapshot_content_digest: string;
    snapshot_artifact_digest: string;
    run_ref: string;
    scan_started_at: string;
    scan_duration_ms: number;
    scanner_descriptors: Json;
    files_analyzed: number;
    files_skipped: number;
    total_bytes: number;
    finding_count: number;
    result_digest: string;
    created_at: string;
  };
  Insert: {
    id?: string;
    workspace_id: string;
    asset_id: string;
    snapshot_id: string;
    scan_job_id: string;
    requested_by: string;
    schema_version?: number;
    scanner_profile_id?: string;
    scanner_profile_version?: number;
    tool_version: string;
    resolved_commit_sha: string;
    snapshot_content_digest: string;
    snapshot_artifact_digest: string;
    run_ref: string;
    scan_started_at: string;
    scan_duration_ms: number;
    scanner_descriptors: Json;
    files_analyzed: number;
    files_skipped: number;
    total_bytes: number;
    finding_count: number;
    result_digest: string;
    created_at?: string;
  };
  Update: Partial<RepositoryScanRunTable["Insert"]>;
  Relationships: [
    { foreignKeyName: "repository_scan_runs_asset_workspace_fkey"; columns: ["asset_id", "workspace_id"]; isOneToOne: false; referencedRelation: "assets"; referencedColumns: ["id", "workspace_id"] },
    { foreignKeyName: "repository_scan_runs_job_workspace_asset_fkey"; columns: ["scan_job_id", "workspace_id", "asset_id"]; isOneToOne: false; referencedRelation: "scan_jobs"; referencedColumns: ["id", "workspace_id", "asset_id"] },
    { foreignKeyName: "repository_scan_runs_snapshot_workspace_asset_fkey"; columns: ["snapshot_id", "workspace_id", "asset_id"]; isOneToOne: false; referencedRelation: "repository_source_snapshots"; referencedColumns: ["id", "workspace_id", "asset_id"] },
    { foreignKeyName: "repository_scan_runs_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] }
  ];
};

export type Phase6cDatabase = Omit<BaseDatabase, "public"> & {
  public: Omit<BaseDatabase["public"], "Tables" | "Functions"> & {
    Tables: BaseDatabase["public"]["Tables"] & {
      repository_scan_runs: RepositoryScanRunTable;
    };
    Functions: BaseDatabase["public"]["Functions"] & Phase6cFunctions;
  };
};
