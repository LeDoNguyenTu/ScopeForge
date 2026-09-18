import type { Json } from "./database.types";
import type { Phase10a3Database } from "./database.phase10a3.types";

export type PentestExecutionMode = "passive" | "safe_active" | "intrusive" | "validation";
export type PentestRunState =
  | "created"
  | "running"
  | "approval_wait"
  | "cancelled"
  | "completed"
  | "failed";
export type PentestHypothesisStatus =
  | "proposed"
  | "eligible"
  | "blocked"
  | "testing"
  | "supported"
  | "refuted"
  | "exhausted";
export type PentestActionState =
  | "planned"
  | "approval_required"
  | "authorized"
  | "queued"
  | "running"
  | "terminal";
export type PentestActionResultStatus =
  | "succeeded"
  | "no_signal"
  | "blocked"
  | "cancelled"
  | "timed_out"
  | "provider_failed"
  | "policy_rejected";

type TableContract<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type TimestampColumns = {
  created_at: string;
  updated_at: string;
};

export type PentestRunTable = TableContract<
  {
    id: string;
    workspace_id: string;
    state: PentestRunState;
    execution_mode_ceiling: PentestExecutionMode;
    request_budget: number;
    graph_expansion_limit: number;
    provider_failure_limit: number;
    started_at: string;
    deadline_at: string;
    created_by: string;
  } & TimestampColumns,
  {
    id?: string;
    workspace_id: string;
    state?: PentestRunState;
    execution_mode_ceiling: PentestExecutionMode;
    request_budget: number;
    graph_expansion_limit: number;
    provider_failure_limit: number;
    started_at: string;
    deadline_at: string;
    created_by: string;
    created_at?: string;
    updated_at?: string;
  },
  Partial<{
    state: PentestRunState;
    execution_mode_ceiling: PentestExecutionMode;
    request_budget: number;
    graph_expansion_limit: number;
    provider_failure_limit: number;
    started_at: string;
    deadline_at: string;
    updated_at: string;
  }>
>;

export type PentestRunAuthorizationSnapshotTable = TableContract<
  {
    id: string;
    workspace_id: string;
    run_id: string;
    snapshot_ref: string;
    authorized_node_ids: string[];
    max_execution_mode: PentestExecutionMode;
    expires_at: string;
    created_at: string;
  },
  {
    id?: string;
    workspace_id: string;
    run_id: string;
    snapshot_ref: string;
    authorized_node_ids: string[];
    max_execution_mode: PentestExecutionMode;
    expires_at: string;
    created_at?: string;
  },
  Partial<{
    authorized_node_ids: string[];
    max_execution_mode: PentestExecutionMode;
    expires_at: string;
  }>
>;

export type PentestGraphNodeTable = TableContract<
  {
    id: string;
    workspace_id: string;
    run_id: string;
    asset_node_id: string;
    asset_type: string;
    canonical_locator: string;
    parent_node_ids: string[];
    authorization_ref: string;
    technology_tags: string[];
    confidence: number;
    provenance_refs: string[];
  } & TimestampColumns,
  {
    id?: string;
    workspace_id: string;
    run_id: string;
    asset_node_id: string;
    asset_type: string;
    canonical_locator: string;
    parent_node_ids?: string[];
    authorization_ref: string;
    technology_tags?: string[];
    confidence: number;
    provenance_refs: string[];
    created_at?: string;
    updated_at?: string;
  },
  Partial<{
    parent_node_ids: string[];
    technology_tags: string[];
    confidence: number;
    provenance_refs: string[];
    updated_at: string;
  }>
>;

export type PentestGraphEdgeTable = TableContract<
  {
    id: string;
    workspace_id: string;
    run_id: string;
    edge_id: string;
    from_node_id: string;
    to_node_id: string;
    relationship: string;
    provenance_kind: string;
    provenance_refs: string[];
    confidence: number;
    observed_at: string;
    authorization_ref: string;
    stale: boolean;
  } & TimestampColumns,
  {
    id?: string;
    workspace_id: string;
    run_id: string;
    edge_id: string;
    from_node_id: string;
    to_node_id: string;
    relationship: string;
    provenance_kind: string;
    provenance_refs: string[];
    confidence: number;
    observed_at: string;
    authorization_ref: string;
    stale?: boolean;
    created_at?: string;
    updated_at?: string;
  },
  Partial<{
    provenance_refs: string[];
    confidence: number;
    observed_at: string;
    stale: boolean;
    updated_at: string;
  }>
>;

export type PentestObservationTable = TableContract<
  {
    id: string;
    workspace_id: string;
    run_id: string;
    observation_id: string;
    provider_id: string;
    provider_version: string;
    capability_id: string;
    asset_node_ids: string[];
    evidence_refs: string[];
    facts: Json;
    observed_at: string;
    confidence: number;
    authorization_snapshot_ref: string;
    execution_mode: PentestExecutionMode;
    created_at: string;
  },
  {
    id?: string;
    workspace_id: string;
    run_id: string;
    observation_id: string;
    provider_id: string;
    provider_version: string;
    capability_id: string;
    asset_node_ids: string[];
    evidence_refs: string[];
    facts: Json;
    observed_at: string;
    confidence: number;
    authorization_snapshot_ref: string;
    execution_mode: PentestExecutionMode;
    created_at?: string;
  },
  never
>;

export type PentestHypothesisTable = TableContract<
  {
    id: string;
    workspace_id: string;
    run_id: string;
    hypothesis_id: string;
    reasoning_source: string;
    target_node_ids: string[];
    statement: string;
    preconditions: string[];
    candidate_capability_ids: string[];
    expected_evidence_types: string[];
    base_confidence: number;
    confidence: number;
    status: PentestHypothesisStatus;
    evidence_refs: string[];
    authorization_snapshot_ref: string;
  } & TimestampColumns,
  {
    id?: string;
    workspace_id: string;
    run_id: string;
    hypothesis_id: string;
    reasoning_source: string;
    target_node_ids: string[];
    statement: string;
    preconditions?: string[];
    candidate_capability_ids: string[];
    expected_evidence_types?: string[];
    base_confidence: number;
    confidence: number;
    status: PentestHypothesisStatus;
    evidence_refs?: string[];
    authorization_snapshot_ref: string;
    created_at?: string;
    updated_at?: string;
  },
  Partial<{
    reasoning_source: string;
    target_node_ids: string[];
    statement: string;
    preconditions: string[];
    candidate_capability_ids: string[];
    expected_evidence_types: string[];
    base_confidence: number;
    confidence: number;
    status: PentestHypothesisStatus;
    evidence_refs: string[];
    authorization_snapshot_ref: string;
    updated_at: string;
  }>
>;

export type PentestActionTable = TableContract<
  {
    id: string;
    workspace_id: string;
    run_id: string;
    action_id: string;
    hypothesis_id: string;
    capability_id: string;
    target_node_ids: string[];
    requested_mode: PentestExecutionMode;
    closed_parameters: Json;
    expected_evidence_types: string[];
    authorization_snapshot_ref: string;
    state: PentestActionState;
  } & TimestampColumns,
  {
    id?: string;
    workspace_id: string;
    run_id: string;
    action_id: string;
    hypothesis_id: string;
    capability_id: string;
    target_node_ids: string[];
    requested_mode: PentestExecutionMode;
    closed_parameters?: Json;
    expected_evidence_types: string[];
    authorization_snapshot_ref: string;
    state?: PentestActionState;
    created_at?: string;
    updated_at?: string;
  },
  Partial<{
    state: PentestActionState;
    updated_at: string;
  }>
>;

export type PentestActionAttemptTable = TableContract<
  {
    id: string;
    workspace_id: string;
    run_id: string;
    action_id: string;
    authorization_id: string;
    provider_id: string;
    provider_version: string;
    status: PentestActionResultStatus;
    observation_ids: string[];
    evidence_refs: string[];
    started_at: string;
    completed_at: string;
    error_code: string | null;
    created_at: string;
  },
  {
    id?: string;
    workspace_id: string;
    run_id: string;
    action_id: string;
    authorization_id: string;
    provider_id: string;
    provider_version: string;
    status: PentestActionResultStatus;
    observation_ids?: string[];
    evidence_refs?: string[];
    started_at: string;
    completed_at: string;
    error_code?: string | null;
    created_at?: string;
  },
  never
>;

export type PentestCoverageTable = TableContract<
  {
    run_id: string;
    workspace_id: string;
    authorization_snapshot_ref: string;
    attempted_capability_ids: string[];
    covered_node_ids: string[];
    untested_node_ids: string[];
    request_count: number;
    graph_expansion_count: number;
    provider_failure_count: number;
    started_at: string;
    deadline_at: string;
    updated_at: string;
  },
  {
    run_id: string;
    workspace_id: string;
    authorization_snapshot_ref: string;
    attempted_capability_ids?: string[];
    covered_node_ids?: string[];
    untested_node_ids?: string[];
    request_count?: number;
    graph_expansion_count?: number;
    provider_failure_count?: number;
    started_at: string;
    deadline_at: string;
    updated_at?: string;
  },
  Partial<{
    authorization_snapshot_ref: string;
    attempted_capability_ids: string[];
    covered_node_ids: string[];
    untested_node_ids: string[];
    request_count: number;
    graph_expansion_count: number;
    provider_failure_count: number;
    started_at: string;
    deadline_at: string;
    updated_at: string;
  }>
>;

export type PentestApprovalEventTable = TableContract<
  {
    id: string;
    workspace_id: string;
    run_id: string;
    action_id: string;
    mode: "intrusive" | "validation";
    approved_by: string;
    approved_by_role: "owner" | "admin";
    expires_at: string;
    created_at: string;
  },
  {
    id?: string;
    workspace_id: string;
    run_id: string;
    action_id: string;
    mode: "intrusive" | "validation";
    approved_by: string;
    approved_by_role: "owner" | "admin";
    expires_at: string;
    created_at?: string;
  },
  never
>;

export type PentestRunEventTable = TableContract<
  {
    id: string;
    workspace_id: string;
    run_id: string;
    authorization_snapshot_ref: string;
    event_type: string;
    metadata: Json;
    created_at: string;
  },
  {
    id?: string;
    workspace_id: string;
    run_id: string;
    authorization_snapshot_ref: string;
    event_type: string;
    metadata?: Json;
    created_at?: string;
  },
  never
>;

export type Phase11Tables = Phase10a3Database["public"]["Tables"] & {
  pentest_runs: PentestRunTable;
  pentest_run_authorization_snapshots: PentestRunAuthorizationSnapshotTable;
  pentest_graph_nodes: PentestGraphNodeTable;
  pentest_graph_edges: PentestGraphEdgeTable;
  pentest_observations: PentestObservationTable;
  pentest_hypotheses: PentestHypothesisTable;
  pentest_actions: PentestActionTable;
  pentest_action_attempts: PentestActionAttemptTable;
  pentest_coverage: PentestCoverageTable;
  pentest_approval_events: PentestApprovalEventTable;
  pentest_run_events: PentestRunEventTable;
};

export type Phase11Functions = Phase10a3Database["public"]["Functions"] & {
  upsert_pentest_graph_node: {
    Args: {
      target_workspace_id: string;
      target_run_id: string;
      target_authorization_snapshot_ref: string;
      target_asset_node_id: string;
      target_asset_type: string;
      target_canonical_locator: string;
      target_parent_node_ids: string[];
      target_technology_tags: string[];
      target_confidence: number;
      target_provenance_refs: string[];
    };
    Returns: Json;
  };
  upsert_pentest_graph_edge: {
    Args: {
      target_workspace_id: string;
      target_run_id: string;
      target_authorization_snapshot_ref: string;
      target_edge_id: string;
      target_from_node_id: string;
      target_to_node_id: string;
      target_relationship: string;
      target_provenance_kind: string;
      target_provenance_refs: string[];
      target_confidence: number;
      target_observed_at: string;
      target_stale: boolean;
    };
    Returns: Json;
  };
  record_pentest_observation: {
    Args: {
      target_workspace_id: string;
      target_run_id: string;
      target_authorization_snapshot_ref: string;
      target_observation_id: string;
      target_provider_id: string;
      target_provider_version: string;
      target_capability_id: string;
      target_asset_node_ids: string[];
      target_evidence_refs: string[];
      target_facts: Json;
      target_observed_at: string;
      target_confidence: number;
      target_execution_mode: PentestExecutionMode;
    };
    Returns: Json;
  };
  upsert_pentest_hypothesis: {
    Args: {
      target_workspace_id: string;
      target_run_id: string;
      target_authorization_snapshot_ref: string;
      target_hypothesis_id: string;
      target_reasoning_source: string;
      target_target_node_ids: string[];
      target_statement: string;
      target_preconditions: string[];
      target_candidate_capability_ids: string[];
      target_expected_evidence_types: string[];
      target_base_confidence: number;
      target_confidence: number;
      target_status: PentestHypothesisStatus;
      target_evidence_refs: string[];
    };
    Returns: Json;
  };
  upsert_pentest_coverage: {
    Args: {
      target_workspace_id: string;
      target_run_id: string;
      target_authorization_snapshot_ref: string;
      target_attempted_capability_ids: string[];
      target_covered_node_ids: string[];
      target_untested_node_ids: string[];
      target_request_count: number;
      target_graph_expansion_count: number;
      target_provider_failure_count: number;
      target_started_at: string;
      target_deadline_at: string;
    };
    Returns: Json;
  };
  append_pentest_run_event: {
    Args: {
      target_workspace_id: string;
      target_run_id: string;
      target_authorization_snapshot_ref: string;
      target_event_type: string;
      target_metadata: Json;
    };
    Returns: string;
  };
};

export type Phase11Database = Omit<Phase10a3Database, "public"> & {
  public: Omit<Phase10a3Database["public"], "Tables" | "Functions"> & {
    Tables: Phase11Tables;
    Functions: Phase11Functions;
  };
};
