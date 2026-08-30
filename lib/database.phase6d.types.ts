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
};

export type Phase6dDatabase = Omit<Phase6cDatabase, "public"> & {
  public: Omit<Phase6cDatabase["public"], "Functions"> & {
    Functions: Phase6cDatabase["public"]["Functions"] & Phase6dFunctions;
  };
};
