import type { Json } from "./database.types";

export type Phase11RunStatus =
  | "created"
  | "running"
  | "waiting_approval"
  | "completed"
  | "cancelled"
  | "failed";

export interface PentestRunSummaryRow {
  run_id: string;
  workspace_id: string;
  root_asset_id: string;
  status: Phase11RunStatus;
  stop_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface PentestGraphNodeSummaryRow {
  workspace_id: string;
  run_id: string;
  node_id: string;
  asset_type: string;
  parent_node_ids: string[];
  technology_tags: string[];
  confidence: number;
  updated_at: string;
}

export interface PentestGraphEdgeSummaryRow {
  workspace_id: string;
  run_id: string;
  edge_id: string;
  from_node_id: string;
  to_node_id: string;
  relationship: string;
  confidence: number;
  stale: boolean;
  updated_at: string;
}

export interface PentestObservationSummaryRow {
  workspace_id: string;
  run_id: string;
  observation_id: string;
  provider_id: string;
  provider_version: string;
  capability_id: string;
  asset_node_ids: string[];
  execution_mode: string;
  confidence: number;
  observed_at: string;
}

export interface PentestHypothesisSummaryRow {
  workspace_id: string;
  run_id: string;
  hypothesis_id: string;
  target_node_ids: string[];
  candidate_capability_ids: string[];
  confidence: number;
  status: string;
  updated_at: string;
}

export interface PentestActionSummaryRow {
  workspace_id: string;
  run_id: string;
  action_id: string;
  hypothesis_id: string;
  capability_id: string;
  target_node_ids: string[];
  requested_mode: string;
  state: string;
  created_at: string;
  updated_at: string;
}

export interface PentestCoverageSummaryRow {
  workspace_id: string;
  run_id: string;
  attempted_capability_count: number;
  covered_node_count: number;
  untested_node_count: number;
  request_count: number;
  graph_expansion_count: number;
  provider_failure_count: number;
  started_at: string;
  deadline_at: string;
  updated_at: string;
}

export interface Phase11GraphPersistenceResult {
  nodeCount: number;
  edgeCount: number;
  hypothesisCount: number;
  eventCount: number;
}

export interface Phase11ObservationPersistenceResult {
  insertedCount: number;
  replayedCount: number;
}

export interface Phase11RpcError {
  message?: string;
  code?: string;
}

export interface Phase11RpcClient {
  rpc(
    functionName:
      | "persist_phase11_graph_state"
      | "persist_phase11_observations"
      | "create_phase11_pentest_run"
      | "load_phase11_pentest_run_state"
      | "record_phase11_action_decision"
      | "mark_phase11_action_queued"
      | "release_phase11_action_enqueue"
      | "approve_phase11_action"
      | "cancel_phase11_pentest_run"
      | "stop_phase11_pentest_run",
    args: Record<string, Json | undefined>,
  ): PromiseLike<{ data: Json | null; error: Phase11RpcError | null }>;
}

export interface Phase11SelectQuery<T> {
  select(columns: string): Phase11SelectQuery<T>;
  eq(column: string, value: string): Phase11SelectQuery<T>;
  order(column: string, options: { ascending: boolean }): Phase11SelectQuery<T>;
  limit(count: number): PromiseLike<{ data: T[] | null; error: Phase11RpcError | null }>;
  maybeSingle(): PromiseLike<{ data: T | null; error: Phase11RpcError | null }>;
}

export interface Phase11ReadClient {
  from(table: "pentest_run_summaries"): Phase11SelectQuery<PentestRunSummaryRow>;
  from(table: "pentest_action_summaries"): Phase11SelectQuery<PentestActionSummaryRow>;
  from(table: "pentest_graph_node_summaries"): Phase11SelectQuery<PentestGraphNodeSummaryRow>;
  from(table: "pentest_graph_edge_summaries"): Phase11SelectQuery<PentestGraphEdgeSummaryRow>;
  from(table: "pentest_observation_summaries"): Phase11SelectQuery<PentestObservationSummaryRow>;
  from(table: "pentest_hypothesis_summaries"): Phase11SelectQuery<PentestHypothesisSummaryRow>;
  from(table: "pentest_coverage_summaries"): Phase11SelectQuery<PentestCoverageSummaryRow>;
}
