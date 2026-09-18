import type { Json } from "./database.types";
import type { Phase11cWorkerDatabase } from "./database.phase11c.types";

export type Phase11cFinalizationFunctions = Phase11cWorkerDatabase["public"]["Functions"] & {
  get_phase11_http_worker_finalization_context: {
    Args: {
      target_worker_id: string;
      target_task_id: string;
      target_attempt_id: string;
      target_lease_token: string;
    };
    Returns: Json;
  };
  finalize_phase11_http_worker_attempt: {
    Args: {
      target_worker_id: string;
      target_task_id: string;
      target_attempt_id: string;
      target_lease_token: string;
      target_terminal_digest: string;
      target_outcome: string;
      target_failure_code: string | null;
      target_request_count: number;
      target_metrics: Json;
      observation_rows: Json;
    };
    Returns: Json;
  };
};

export type Phase11cFinalizationDatabase = Omit<Phase11cWorkerDatabase, "public"> & {
  public: Omit<Phase11cWorkerDatabase["public"], "Functions"> & {
    Functions: Phase11cFinalizationFunctions;
  };
};
