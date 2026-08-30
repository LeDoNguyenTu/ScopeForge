import type { Phase6cDatabase } from "./database.phase6c.types";
import type { Json } from "./database.types";

type Phase6dFunctions = {
  register_passive_runtime_worker_node: {
    Args: { target_credential_hash: string; target_software_version: string };
    Returns: Json;
  };
  register_active_cors_worker_node: {
    Args: { target_credential_hash: string; target_software_version: string };
    Returns: Json;
  };
  enqueue_passive_runtime_worker_task: {
    Args: { target_workspace_id: string; target_scan_job_id: string; target_actor_id: string };
    Returns: Json;
  };
  enqueue_active_cors_worker_task: {
    Args: { target_workspace_id: string; target_scan_job_id: string; target_actor_id: string };
    Returns: Json;
  };
  claim_runtime_worker_task: {
    Args: { target_worker_id: string };
    Returns: Json;
  };
  get_runtime_worker_preparation_context: {
    Args: {
      target_worker_id: string;
      target_task_id: string;
      target_attempt_id: string;
      target_lease_token: string;
    };
    Returns: Json;
  };
  get_runtime_worker_finalization_context: {
    Args: {
      target_worker_id: string;
      target_task_id: string;
      target_attempt_id: string;
      target_lease_token: string;
    };
    Returns: Json;
  };
  finalize_runtime_worker_attempt: {
    Args: {
      target_worker_id: string;
      target_task_id: string;
      target_attempt_id: string;
      target_lease_token: string;
      target_execution_class: string;
      target_terminal_digest: string;
      target_outcome: string;
      target_failure_code: string | null;
      target_request_count: number;
      target_redirect_count: number;
      target_finding_count: number;
      target_wall_time_ms: number;
      target_cpu_time_ms: number;
      target_peak_memory_bytes: number;
      target_input_bytes: number;
      target_output_bytes: number;
    };
    Returns: Json;
  };
};

export type Phase6dDatabase = Omit<Phase6cDatabase, "public"> & {
  public: Omit<Phase6cDatabase["public"], "Functions"> & {
    Functions: Phase6cDatabase["public"]["Functions"] & Phase6dFunctions;
  };
};
