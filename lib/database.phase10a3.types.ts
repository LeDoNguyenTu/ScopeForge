import type { Json } from "./database.types";
import type { Phase10a2Database } from "./database.phase10a2.types";

export type Phase10a3Functions = Phase10a2Database["public"]["Functions"] & {
  admit_github_webhook_delivery: {
    Args: {
      target_delivery_id: string;
      target_event_name: string;
      target_action: string | null;
      target_installation_id: number | null;
      target_repository_id: number | null;
      target_push_after_sha: string | null;
    };
    Returns: Json;
  };
  get_github_webhook_repository_context: {
    Args: {
      target_installation_id: number;
      target_repository_id: number;
    };
    Returns: Json;
  };
  record_github_webhook_push_head: {
    Args: {
      target_workspace_id: string;
      target_link_id: string;
      target_repository_id: number;
      target_delivery_id: string;
      target_commit_sha: string;
    };
    Returns: Json;
  };
  enqueue_github_webhook_project_snapshot: {
    Args: {
      target_workspace_id: string;
      target_link_id: string;
      target_delivery_id: string;
      target_commit_sha: string;
    };
    Returns: Json;
  };
  record_github_webhook_delivery_result: {
    Args: {
      target_delivery_id: string;
      target_state: string;
      target_result_code: string | null;
    };
    Returns: Json;
  };
  reconcile_github_webhook_connection_state: {
    Args: {
      target_installation_id: number;
      target_status: string;
      target_account_id: number | null;
      target_account_login: string | null;
      target_account_type: string | null;
      target_repository_selection: string | null;
    };
    Returns: Json;
  };
  reconcile_github_webhook_repository_state: {
    Args: {
      target_installation_id: number;
      target_repository_id: number;
      target_owner_login: string;
      target_repository_name: string;
      target_full_name: string;
      target_default_branch: string;
      target_is_private: boolean;
      target_html_url: string;
      target_provider_archived: boolean;
      target_access_status: string;
    };
    Returns: Json;
  };
  complete_github_webhook_project_scan: {
    Args: {
      target_snapshot_task_id: string;
      target_snapshot_id: string;
    };
    Returns: Json;
  };
  settle_manual_connected_project_scan_terminal: {
    Args: {
      target_scan_task_id: string;
    };
    Returns: Json;
  };
};

export type Phase10a3Database = Omit<Phase10a2Database, "public"> & {
  public: Omit<Phase10a2Database["public"], "Functions"> & {
    Functions: Phase10a3Functions;
  };
};
