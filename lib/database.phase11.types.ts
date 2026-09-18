import type { Json } from "./database.types";
import type { Phase10a3Database } from "./database.phase10a3.types";

export type PentestRunStatus =
  | "created"
  | "running"
  | "waiting_approval"
  | "cancelling"
  | "cancelled"
  | "succeeded"
  | "failed";

export type PentestExecutionMode = "passive" | "safe_active" | "intrusive" | "validation";

export type Phase11Functions = Phase10a3Database["public"]["Functions"] & {
  persist_pentest_planning_state: {
    Args: {
      target_workspace_id: string;
      target_run_id: string;
      target_authorization_snapshot_ref: string;
      graph_node_rows: Json;
      graph_edge_rows: Json;
      observation_rows: Json;
      hypothesis_rows: Json;
      coverage_row: Json;
      event_rows: Json;
    };
    Returns: Json;
  };
};

type PentestRunReadView = {
  Row: {
    workspace_id: string;
    run_id: string;
    status: PentestRunStatus;
    execution_mode_ceiling: PentestExecutionMode;
    deadline_at: string;
    created_at: string;
    updated_at: string;
  };
  Relationships: [];
};

type PentestGraphNodeReadView = {
  Row: {
    workspace_id: string;
    run_id: string;
    node_id: string;
    asset_type: string;
    technology_tags: string[];
    confidence: number;
    created_at: string;
    updated_at: string;
  };
  Relationships: [];
};

type PentestGraphEdgeReadView = {
  Row: {
    workspace_id: string;
    run_id: string;
    edge_id: string;
    from_node_id: string;
    to_node_id: string;
    relationship: string;
    confidence: number;
    observed_at: string;
    stale: boolean;
    created_at: string;
    updated_at: string;
  };
  Relationships: [];
};

type PentestObservationReadView = {
  Row: {
    workspace_id: string;
    run_id: string;
    observation_id: string;
    provider_id: string;
    provider_version: string;
    capability_id: string;
    asset_node_ids: string[];
    observed_at: string;
    confidence: number;
    execution_mode: PentestExecutionMode;
    evidence_count: number;
    created_at: string;
  };
  Relationships: [];
};

type PentestHypothesisReadView = {
  Row: {
    workspace_id: string;
    run_id: string;
    hypothesis_id: string;
    reasoning_source: string;
    target_node_ids: string[];
    candidate_capability_ids: string[];
    confidence: number;
    status: string;
    created_at: string;
    updated_at: string;
  };
  Relationships: [];
};

type PentestRunCoverageReadView = {
  Row: {
    workspace_id: string;
    run_id: string;
    attempted_capability_ids: string[];
    covered_node_count: number;
    untested_node_count: number;
    request_count: number;
    graph_expansion_count: number;
    provider_failure_count: number;
    deadline_at: string;
    updated_at: string;
  };
  Relationships: [];
};

export type Phase11Views = Phase10a3Database["public"]["Views"] & {
  pentest_runs_read: PentestRunReadView;
  pentest_graph_nodes_read: PentestGraphNodeReadView;
  pentest_graph_edges_read: PentestGraphEdgeReadView;
  pentest_observations_read: PentestObservationReadView;
  pentest_hypotheses_read: PentestHypothesisReadView;
  pentest_run_coverage_read: PentestRunCoverageReadView;
};

export type Phase11Database = Omit<Phase10a3Database, "public"> & {
  public: Omit<Phase10a3Database["public"], "Functions" | "Views"> & {
    Functions: Phase11Functions;
    Views: Phase11Views;
  };
};
