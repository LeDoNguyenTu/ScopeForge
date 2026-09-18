import type { Json } from "./database.types";
import type { Phase10a2Database } from "./database.phase10a2.types";

export type Phase11cWorkerFunctions = Phase10a2Database["public"]["Functions"] & {
  register_phase11_http_worker_node: {
    Args: { target_credential_hash: string; target_software_version: string };
    Returns: Json;
  };
  claim_phase11_http_worker_task: {
    Args: { target_worker_id: string };
    Returns: Json;
  };
  enqueue_phase11_http_worker_task: {
    Args: {
      target_workspace_id: string;
      target_run_id: string;
      target_action_id: string;
      target_authorization_id: string;
    };
    Returns: Json;
  };
  get_phase11_http_worker_preparation_context: {
    Args: {
      target_worker_id: string;
      target_task_id: string;
      target_attempt_id: string;
      target_lease_token: string;
    };
    Returns: Json;
  };
};

export type Phase11cWorkerDatabase = Omit<Phase10a2Database, "public"> & {
  public: Omit<Phase10a2Database["public"], "Functions"> & {
    Functions: Phase11cWorkerFunctions;
  };
};
